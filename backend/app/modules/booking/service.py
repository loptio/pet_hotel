"""BookingService — gateway-exposed (BookingService).

Owns booking creation with three-way danger gating (FR-02.8), deposit/total
computation (FR-05.3 deposit = 30%), resource locking (FR-03.2, via
resources.allocate_kennels), deposit/final charging through PaymentService
(FR-05.3), and staff review of PendingReview bookings (seq5). It also exposes the
no-show sweep (FR-03.5) as a callable method — there is no no-show route in the
frozen contract, so it is invoked by scripts/no_show_sweep.py (reported to
command side as a contract gap).

Danger gating (FR-02.8), per pet on the booking:
- blocked / High → 409 (the pet was auto-blocked by S2a; gate keys on is_blocked);
- Medium → booking created PendingReview (front-desk must approve);
- None / Low → PendingDeposit (Low's warning surfaces at the check-in interface).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import Principal, STAFF_ROLES
from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.booking import mappers as m
from app.modules.booking import resources as res
from app.modules.booking import schemas as s
from app.modules.booking.models import (
    BookedPet,
    Booking,
    BookingItem,
    BookingStatus,
    ServiceCategory,
    ServiceItem,
)
from app.modules.booking.state import assert_booking_transition
from app.modules.notification.models import NotificationType
from app.modules.notification.service import notification_service
from app.modules.payment.models import PaymentType
from app.modules.payment.service import payment_service
from app.modules.pet.models import DangerLevel, Pet

DEPOSIT_RATE = Decimal("0.30")  # FR-05.3 deposit = 30% of estimated total
NO_SHOW_GRACE = timedelta(hours=2)  # FR-03.5 — 2h after start → NoShow


def _now() -> datetime:
    return datetime.now(timezone.utc)


class BookingService:
    # ----- helpers -----
    def _booking_or_404(self, db: Session, booking_id: uuid.UUID) -> Booking:
        booking = db.get(Booking, booking_id)
        if booking is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        return booking

    def _readable_booking_or_404(
        self, db: Session, booking_id: uuid.UUID, principal: Principal
    ) -> Booking:
        """Owner sees only their own; staff/admin may read any. 404 (not 403) for
        someone else's booking so existence isn't leaked across owners."""
        booking = self._booking_or_404(db, booking_id)
        if booking.owner_id != principal.account_id and not (principal.roles & STAFF_ROLES):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        return booking

    @staticmethod
    def _deposit_of(total: Decimal) -> Decimal:
        return (total * DEPOSIT_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # ----- FR-03.1/03.7 catalogue -----
    def list_services(self, db: Session, category: ServiceCategory | None) -> list[s.ServiceItemOut]:
        stmt = select(ServiceItem).where(ServiceItem.is_active.is_(True))
        if category is not None:
            stmt = stmt.where(ServiceItem.category == category)
        items = db.execute(stmt.order_by(ServiceItem.category, ServiceItem.name)).scalars().all()
        return [m.service_item_out(si) for si in items]

    # ----- FR-03.2/06.2 availability -----
    def check_availability(
        self, db: Session, service_item_id: uuid.UUID, start_at: datetime, end_at: datetime
    ) -> s.AvailabilityOut:
        si = db.get(ServiceItem, service_item_id)
        if si is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Service item not found")
        if start_at >= end_at:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_at must be before end_at")

        if si.category == ServiceCategory.LODGING:
            from app.modules.booking.models import Kennel, KennelStatus

            available_beds = db.execute(
                select(Kennel).where(
                    Kennel.type == si.room_type, Kennel.status == KennelStatus.AVAILABLE
                )
            ).scalars().first()
            available = available_beds is not None
        else:
            # Grooming capacity = a groomer exists (no fine-grained schedule in the demo).
            available = self._any_groomer(db) is not None

        from app.modules.booking.models import AvailabilitySlot

        slots = db.execute(
            select(AvailabilitySlot).where(
                AvailabilitySlot.service_item_id == service_item_id,
                AvailabilitySlot.start_at < end_at,
                AvailabilitySlot.end_at > start_at,
            )
        ).scalars().all()
        return s.AvailabilityOut(
            available=available,
            slots=[
                s.AvailabilitySlotOut(
                    id=sl.id,
                    service_item_id=sl.service_item_id,
                    start_at=sl.start_at,
                    end_at=sl.end_at,
                    capacity=sl.capacity,
                )
                for sl in slots
            ],
        )

    @staticmethod
    def _any_groomer(db: Session):
        from app.core.security import ROLE_GROOMER
        from app.modules.auth.models import Account, Role, RoleAssignment

        return db.execute(
            select(Account)
            .join(RoleAssignment, RoleAssignment.account_id == Account.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(Role.name == ROLE_GROOMER)
            .order_by(Account.created_at)
        ).scalars().first()

    # ----- FR-02.8 pending-review list (staff) -----
    def list_pending_review(self, db: Session) -> list[s.BookingOut]:
        bookings = db.execute(
            select(Booking)
            .where(Booking.status == BookingStatus.PENDING_REVIEW)
            .order_by(Booking.created_at)
        ).scalars().all()
        return [m.booking_out(b) for b in bookings]

    # ----- FR-03.1 create (danger gating + totals + lock) -----
    def create_booking(
        self, db: Session, owner_id: uuid.UUID, body: s.BookingCreateIn
    ) -> s.BookingOut:
        if body.start_at >= body.end_at:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_at must be before end_at")

        # Resolve + validate pets (owned) and services (active), compute lines.
        pets: dict[uuid.UUID, Pet] = {}
        services: dict[uuid.UUID, ServiceItem] = {}
        total = Decimal("0.00")
        for item in body.items:
            if item.pet_id not in pets:
                pet = db.get(Pet, item.pet_id)
                if pet is None or pet.owner_id != owner_id:
                    raise HTTPException(status.HTTP_404_NOT_FOUND, f"Pet {item.pet_id} not found")
                pets[item.pet_id] = pet
            if item.service_item_id not in services:
                si = db.get(ServiceItem, item.service_item_id)
                if si is None or not si.is_active:
                    raise HTTPException(
                        status.HTTP_404_NOT_FOUND, f"Service item {item.service_item_id} not found"
                    )
                services[item.service_item_id] = si
            total += services[item.service_item_id].base_price * item.quantity

        # FR-02.8 danger gating across all pets on the booking.
        if any(p.is_blocked or p.danger_level == DangerLevel.HIGH for p in pets.values()):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Booking rejected: a pet's danger level is High (blocked). "
                "An admin must unblock the pet before booking.",
            )
        needs_review = any(p.danger_level == DangerLevel.MEDIUM for p in pets.values())
        booking_status = BookingStatus.PENDING_REVIEW if needs_review else BookingStatus.PENDING_DEPOSIT

        booking = Booking(
            owner_id=owner_id,
            status=booking_status,
            start_at=body.start_at,
            end_at=body.end_at,
            total_amount=total,
            deposit_amount=self._deposit_of(total),
            currency="TWD",
        )
        db.add(booking)
        db.flush()

        booked_pets: dict[uuid.UUID, BookedPet] = {}
        for pet_id in pets:
            bp = BookedPet(booking_id=booking.id, pet_id=pet_id)
            db.add(bp)
            booked_pets[pet_id] = bp
        db.flush()

        for item in body.items:
            si = services[item.service_item_id]
            db.add(
                BookingItem(
                    booking_id=booking.id,
                    service_item_id=si.id,
                    booked_pet_id=booked_pets[item.pet_id].id,
                    unit_price=si.base_price,
                    currency=si.currency,
                    quantity=item.quantity,
                )
            )
        db.flush()
        db.refresh(booking)

        # FR-03.2: lock resources at submission for the path that proceeds now.
        # Medium/PendingReview defers allocation to review approval.
        if booking_status == BookingStatus.PENDING_DEPOSIT:
            res.allocate_kennels(db, booking, operator_id=owner_id)

        audit_service.audit(
            db,
            action_type=AuditActionType.BOOKING_CREATED,
            entity_type="Booking",
            entity_id=booking.id,
            operator_id=owner_id,
        )
        notification_service.notify(
            db,
            recipient_id=owner_id,
            type=NotificationType.BOOKING_CREATED,
            title="預約已建立",
            message="您的預約已建立。"
            + ("待櫃台審核（中度危險）。" if needs_review else "請於期限內支付 30% 訂金以確認。"),
            booking_id=booking.id,
            mark_sent=True,
        )
        db.commit()
        db.refresh(booking)
        return m.booking_out(booking)

    # ----- FR-03.4 list / detail -----
    def list_bookings(
        self, db: Session, owner_id: uuid.UUID, status_filter: BookingStatus | None
    ) -> list[s.BookingOut]:
        stmt = select(Booking).where(Booking.owner_id == owner_id)
        if status_filter is not None:
            stmt = stmt.where(Booking.status == status_filter)
        bookings = db.execute(stmt.order_by(Booking.created_at.desc())).scalars().all()
        return [m.booking_out(b) for b in bookings]

    def get_booking(
        self, db: Session, booking_id: uuid.UUID, principal: Principal
    ) -> s.BookingDetailOut:
        booking = self._readable_booking_or_404(db, booking_id, principal)
        return m.booking_detail_out(booking)

    # ----- FR-05.3 deposit (30%) + confirm -----
    def pay_deposit(
        self, db: Session, booking_id: uuid.UUID, owner_id: uuid.UUID, body: s.DepositPaymentIn
    ) -> s.BookingPaymentResultOut:
        booking = self._booking_or_404(db, booking_id)
        if booking.owner_id != owner_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        if booking.status != BookingStatus.PENDING_DEPOSIT:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Deposit can only be paid from PendingDeposit (is {booking.status.value})",
            )

        txn = payment_service.charge(
            db,
            booking_id=booking.id,
            payment_type=PaymentType.DEPOSIT,
            method=body.payment_method,
            amount=booking.deposit_amount,
            currency=booking.currency,
            operator_id=owner_id,
        )
        assert_booking_transition(booking.status, BookingStatus.CONFIRMED)
        booking.status = BookingStatus.CONFIRMED
        db.commit()
        db.refresh(booking)
        return s.BookingPaymentResultOut(booking=m.booking_out(booking), payment=m.payment_result_out(txn))

    # ----- FR-05.3 final payment -----
    def pay_final(
        self, db: Session, booking_id: uuid.UUID, principal: Principal, body: s.FinalPaymentIn
    ) -> s.BookingPaymentResultOut:
        booking = self._readable_booking_or_404(db, booking_id, principal)
        payable = {
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
            BookingStatus.COMPLETED,
        }
        if booking.status not in payable:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Final payment not allowed in status {booking.status.value} (pay the deposit first)",
            )
        balance = booking.total_amount - booking.deposit_amount
        txn = payment_service.charge(
            db,
            booking_id=booking.id,
            payment_type=PaymentType.FINAL_PAY,
            method=body.payment_method,
            amount=balance,
            currency=booking.currency,
            operator_id=principal.account_id,
        )
        db.commit()
        db.refresh(booking)
        return s.BookingPaymentResultOut(booking=m.booking_out(booking), payment=m.payment_result_out(txn))

    # ----- FR-02.8 review (approve / reject), seq5 -----
    def review_booking(
        self, db: Session, booking_id: uuid.UUID, staff_id: uuid.UUID, body: s.ReviewIn
    ) -> s.BookingOut:
        booking = self._booking_or_404(db, booking_id)
        if booking.status != BookingStatus.PENDING_REVIEW:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Only PendingReview bookings can be reviewed (is {booking.status.value})",
            )

        if body.decision == s.ReviewDecision.APPROVED:
            assert_booking_transition(booking.status, BookingStatus.PENDING_DEPOSIT)
            booking.status = BookingStatus.PENDING_DEPOSIT
            # Deferred resource lock now that it's approved (FR-03.2).
            res.allocate_kennels(db, booking, operator_id=staff_id)
            notification_service.notify(
                db,
                recipient_id=booking.owner_id,
                type=NotificationType.BOOKING_CREATED,
                title="預約審核通過",
                message="您的預約已通過審核，請支付 30% 訂金以確認。",
                booking_id=booking.id,
                mark_sent=True,
            )
        else:
            assert_booking_transition(booking.status, BookingStatus.CANCELLED)
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = _now()
            booking.cancel_reason = body.staff_note or "Rejected at review (FR-02.8)"
            audit_service.audit(
                db,
                action_type=AuditActionType.BOOKING_CANCELLED,
                entity_type="Booking",
                entity_id=booking.id,
                operator_id=staff_id,
            )
        db.commit()
        db.refresh(booking)
        return m.booking_out(booking)

    # ----- FR-03.5 no-show sweep (manual; no contract route — see module docstring) -----
    def mark_no_shows(self, db: Session, now: datetime | None = None) -> int:
        """Scan Confirmed bookings whose start time is >2h past and mark them
        NoShow, releasing their resources (FR-03.5). Returns the count swept."""
        now = now or _now()
        cutoff = now - NO_SHOW_GRACE
        stale = db.execute(
            select(Booking).where(
                Booking.status == BookingStatus.CONFIRMED, Booking.start_at < cutoff
            )
        ).scalars().all()
        for booking in stale:
            assert_booking_transition(booking.status, BookingStatus.NO_SHOW)
            booking.status = BookingStatus.NO_SHOW
            res.release_booking_resources(db, booking)
            audit_service.audit(
                db,
                action_type=AuditActionType.BOOKING_CANCELLED,
                entity_type="Booking",
                entity_id=booking.id,
                operator_id=None,
            )
        db.commit()
        return len(stale)


booking_service = BookingService()
