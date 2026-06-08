"""CheckInService — gateway-exposed (CheckInService) + front-desk kennel mgmt.

seq2 / FR-04.1 / FR-06.1: verify the booking is Confirmed, match the chip, then
auto-verify vaccine validity — expired/missing → Blocked (admission paused,
FR-06.1); valid → occupy the kennel for lodging (FR-03.6/06.4) and open a
WorkOrder for each grooming item, then Booking → CheckedIn. Also FR-02.5 counter
vaccine entry (auto-verify expiry) and front-desk kennel management
(FR-03.6/06.4). Front-desk emergency (FR-06.3 / SDD §8) records a Booking-layer
EmergencyEvent and aborts an in-house booking.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import ROLE_GROOMER
from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.auth.models import Account, Role, RoleAssignment
from app.modules.booking import resources as res
from app.modules.booking.models import (
    BookedPet,
    Booking,
    BookingStatus,
    Kennel,
    KennelStatus,
    ServiceCategory,
    ServiceItem,
)
from app.modules.booking.state import assert_booking_transition, assert_kennel_transition
from app.modules.checkin import schemas as s
from app.modules.checkin.models import CheckIn, CheckInResult
from app.modules.grooming.models import EmergencyEvent, WorkOrder, WorkStatus
from app.modules.notification.models import NotificationType
from app.modules.notification.service import notification_service
from app.modules.pet.models import DangerLevel, Pet, VaccinationRecord, VaccinationStatus

ACTIVE_OCCUPANCY = (BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CheckInService:
    # ----- helpers -----
    def _booking_or_404(self, db: Session, booking_id: uuid.UUID) -> Booking:
        booking = db.get(Booking, booking_id)
        if booking is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        return booking

    def _pet_in_booking(self, db: Session, booking: Booking, pet_id: uuid.UUID) -> Pet:
        if not any(bp.pet_id == pet_id for bp in booking.booked_pets):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet is not part of this booking")
        pet = db.get(Pet, pet_id)
        if pet is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
        return pet

    def _match_pet_by_chip(self, db: Session, booking: Booking, chip_id: str) -> Pet:
        for bp in booking.booked_pets:
            pet = db.get(Pet, bp.pet_id)
            if pet is not None and pet.chip_id == chip_id:
                return pet
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Chip ID does not match any pet on this booking"
        )

    @staticmethod
    def _any_groomer(db: Session) -> Account | None:
        return db.execute(
            select(Account)
            .join(RoleAssignment, RoleAssignment.account_id == Account.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(Role.name == ROLE_GROOMER)
            .order_by(Account.created_at)
        ).scalars().first()

    def _vaccine_state(self, db: Session, pet_id: uuid.UUID, on_date: date) -> tuple[bool, str | None]:
        """FR-06.1 — valid iff the pet has a non-rejected vaccine whose expiry is
        on/after the check-in date."""
        records = db.execute(
            select(VaccinationRecord).where(VaccinationRecord.pet_id == pet_id)
        ).scalars().all()
        if not records:
            return False, "VaccineMissing"
        valid = any(
            r.expires_at is not None
            and r.expires_at >= on_date
            and r.status != VaccinationStatus.REJECTED
            for r in records
        )
        return (True, None) if valid else (False, "VaccineExpired")

    def _expire_stale_vaccines(self, db: Session, pet_id: uuid.UUID, on_date: date) -> None:
        for r in db.execute(
            select(VaccinationRecord).where(VaccinationRecord.pet_id == pet_id)
        ).scalars().all():
            if r.expires_at is not None and r.expires_at < on_date:
                r.status = VaccinationStatus.EXPIRED

    def _create_work_orders(self, db: Session, booking: Booking) -> None:
        groomer: Account | None = None
        for item in booking.items:
            si = db.get(ServiceItem, item.service_item_id)
            if si is None or si.category != ServiceCategory.GROOMING:
                continue
            exists = db.execute(
                select(WorkOrder).where(WorkOrder.booking_item_id == item.id)
            ).scalar_one_or_none()
            if exists is not None:
                continue
            if groomer is None:
                groomer = self._any_groomer(db)
                if groomer is None:
                    raise HTTPException(
                        status.HTTP_409_CONFLICT, "No groomer available to assign the work order"
                    )
            db.add(
                WorkOrder(
                    booking_item_id=item.id,
                    assigned_to_id=groomer.id,
                    status=WorkStatus.PENDING,
                )
            )
        db.flush()

    def _kennel_out(self, db: Session, kennel: Kennel) -> s.KennelOut:
        occupant = None
        if kennel.status in (KennelStatus.RESERVED, KennelStatus.OCCUPIED):
            occupant = db.execute(
                select(BookedPet, Booking, Pet)
                .join(Booking, Booking.id == BookedPet.booking_id)
                .join(Pet, Pet.id == BookedPet.pet_id)
                .where(
                    BookedPet.kennel_id == kennel.id,
                    Booking.status.in_(ACTIVE_OCCUPANCY),
                )
                .order_by(Booking.created_at.desc())
            ).first()
        out = s.KennelOut(
            id=kennel.id,
            kennel_number=kennel.kennel_number,
            type=kennel.type,
            status=kennel.status,
        )
        if occupant is not None:
            _bp, bk, pet = occupant
            out.occupied_by_pet_id = pet.id
            out.occupied_by_pet_name = pet.name
            out.occupied_by_booking_id = bk.id
        return out

    # ----- FR-04.1 verify -----
    def verify_booking(self, db: Session, booking_id: uuid.UUID) -> s.BookingVerifyOut:
        booking = self._booking_or_404(db, booking_id)
        valid = booking.status == BookingStatus.CONFIRMED
        messages: list[str] = []
        if not valid:
            messages.append(
                f"預約狀態為 {booking.status.value}，須為 Confirmed 才能報到。"
            )
        levels = {
            db.get(Pet, bp.pet_id).danger_level
            for bp in booking.booked_pets
            if db.get(Pet, bp.pet_id) is not None
        }
        # FR-02.8 — low/medium danger surfaces a warning at the check-in interface.
        if DangerLevel.MEDIUM in levels:
            messages.append("注意：本預約含中度危險寵物，請小心處理。")
        elif DangerLevel.LOW in levels:
            messages.append("提醒：本預約含低度危險寵物。")
        return s.BookingVerifyOut(
            booking_id=booking.id,
            status=booking.status,
            valid=valid,
            message=" ".join(messages) or None,
        )

    # ----- FR-04.1 / 06.1 check-in (seq2) -----
    def check_in(
        self, db: Session, staff_id: uuid.UUID, body: s.CheckInRequestIn
    ) -> s.CheckInResultOut:
        booking = self._booking_or_404(db, body.booking_id)
        existing = db.execute(
            select(CheckIn).where(CheckIn.booking_id == booking.id)
        ).scalar_one_or_none()
        if existing is not None and existing.result == CheckInResult.SUCCESS:
            raise HTTPException(status.HTTP_409_CONFLICT, "Booking is already checked in")
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Booking must be Confirmed to check in (is {booking.status.value})",
            )

        pet = self._match_pet_by_chip(db, booking, body.chip_id)
        today = date.today()
        ok, reason = self._vaccine_state(db, pet.id, today)

        if not ok:
            # FR-06.1 — pause admission; record the blocked attempt + notify.
            self._expire_stale_vaccines(db, pet.id, today)
            ci = existing or CheckIn(booking_id=booking.id, handled_by_id=staff_id,
                                     result=CheckInResult.BLOCKED)
            ci.handled_by_id = staff_id
            ci.result = CheckInResult.BLOCKED
            if existing is None:
                db.add(ci)
            audit_service.audit(
                db,
                action_type=AuditActionType.CHECK_IN_BLOCKED,
                entity_type="Booking",
                entity_id=booking.id,
                operator_id=staff_id,
            )
            notification_service.notify(
                db,
                recipient_id=booking.owner_id,
                type=NotificationType.VACCINE_EXPIRED,
                title="報到暫停：疫苗異常",
                message="寵物疫苗已逾期或缺少有效證明，請補件後再辦理報到（FR-06.1）。",
                booking_id=booking.id,
                mark_sent=True,
            )
            db.commit()
            return s.CheckInResultOut(
                booking_id=booking.id, result=CheckInResult.BLOCKED, reason=reason
            )

        # Success — occupy beds (lodging) + open work orders (grooming) + CheckedIn.
        kennel_numbers = res.occupy_kennels(db, booking, operator_id=staff_id)
        self._create_work_orders(db, booking)
        assert_booking_transition(booking.status, BookingStatus.CHECKED_IN)
        booking.status = BookingStatus.CHECKED_IN

        ci = existing or CheckIn(booking_id=booking.id, handled_by_id=staff_id,
                                 result=CheckInResult.SUCCESS)
        ci.handled_by_id = staff_id
        ci.result = CheckInResult.SUCCESS
        ci.checked_in_at = _now()
        if existing is None:
            db.add(ci)

        audit_service.audit(
            db,
            action_type=AuditActionType.CHECK_IN_SUCCESS,
            entity_type="Booking",
            entity_id=booking.id,
            operator_id=staff_id,
        )
        notification_service.notify(
            db,
            recipient_id=booking.owner_id,
            type=NotificationType.CHECK_IN_SUCCESS,
            title="報到成功",
            message="您的寵物已完成報到。" + (f"床位：{kennel_numbers[0]}。" if kennel_numbers else ""),
            booking_id=booking.id,
            mark_sent=True,
        )
        db.commit()
        return s.CheckInResultOut(
            booking_id=booking.id,
            result=CheckInResult.SUCCESS,
            kennel_number=kennel_numbers[0] if kennel_numbers else None,
        )

    # ----- FR-02.5 / 06.1 counter vaccine entry -----
    def record_vaccine(
        self, db: Session, staff_id: uuid.UUID, booking_id: uuid.UUID, body: s.VaccineRecordAtCounterIn
    ) -> VaccinationRecord:
        booking = self._booking_or_404(db, booking_id)
        self._pet_in_booking(db, booking, body.pet_id)
        is_valid = body.expires_at >= date.today()
        record = VaccinationRecord(
            pet_id=body.pet_id,
            vaccine_name=body.vaccine_name,
            administered_at=body.administered_at,
            expires_at=body.expires_at,
            status=VaccinationStatus.VALID if is_valid else VaccinationStatus.EXPIRED,
            verified_at=_now(),
            verified_by_id=staff_id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    # ----- FR-06.4 check-out -----
    def check_out(self, db: Session, staff_id: uuid.UUID, booking_id: uuid.UUID) -> s.CheckInResultOut:
        booking = self._booking_or_404(db, booking_id)
        if booking.status not in (BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Booking is not checked in (is {booking.status.value})",
            )
        numbers = res.checkout_kennels(db, booking, operator_id=staff_id)
        ci = db.execute(select(CheckIn).where(CheckIn.booking_id == booking.id)).scalar_one_or_none()
        if ci is not None:
            ci.checked_out_at = _now()
        res.maybe_complete_booking(db, booking, operator_id=staff_id)
        db.commit()
        return s.CheckInResultOut(
            booking_id=booking.id,
            result=CheckInResult.SUCCESS,
            kennel_number=numbers[0] if numbers else None,
        )

    # ----- FR-03.6 kennel listing -----
    def list_kennels(self, db: Session) -> list[s.KennelOut]:
        kennels = db.execute(select(Kennel).order_by(Kennel.kennel_number)).scalars().all()
        return [self._kennel_out(db, k) for k in kennels]

    # ----- FR-06.4 kennel status update -----
    def update_kennel(
        self, db: Session, staff_id: uuid.UUID, kennel_id: uuid.UUID, body: s.KennelUpdateIn
    ) -> s.KennelOut:
        kennel = db.get(Kennel, kennel_id)
        if kennel is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Kennel not found")
        assert_kennel_transition(kennel.status, body.status)
        if kennel.status != body.status:
            kennel.status = body.status
            audit_service.audit(
                db,
                action_type=AuditActionType.KENNEL_STATUS_CHANGED,
                entity_type="Kennel",
                entity_id=kennel.id,
                operator_id=staff_id,
            )
        db.commit()
        db.refresh(kennel)
        return self._kennel_out(db, kennel)

    def mark_kennel_available(
        self, db: Session, staff_id: uuid.UUID, kennel_id: uuid.UUID
    ) -> s.KennelOut:
        kennel = db.get(Kennel, kennel_id)
        if kennel is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Kennel not found")
        if kennel.status != KennelStatus.CLEANING:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Kennel must be Cleaning to mark Available (is {kennel.status.value})",
            )
        kennel.status = KennelStatus.AVAILABLE
        audit_service.audit(
            db,
            action_type=AuditActionType.KENNEL_STATUS_CHANGED,
            entity_type="Kennel",
            entity_id=kennel.id,
            operator_id=staff_id,
        )
        db.commit()
        db.refresh(kennel)
        return self._kennel_out(db, kennel)

    # ----- FR-06.3 / SDD §8 front-desk emergency -----
    def trigger_emergency(
        self, db: Session, staff_id: uuid.UUID, booking_id: uuid.UUID, body: s.EmergencyAtCounterIn
    ) -> EmergencyEvent:
        booking = self._booking_or_404(db, booking_id)
        self._pet_in_booking(db, booking, body.pet_id)
        event = EmergencyEvent(
            booking_id=booking.id,
            pet_id=body.pet_id,
            work_order_id=None,  # front-desk / lodging emergency has no work order
            reported_by_id=staff_id,
            description=body.description,
            occurred_at=_now(),
        )
        db.add(event)
        db.flush()
        audit_service.audit(
            db,
            action_type=AuditActionType.EMERGENCY_TRIGGERED,
            entity_type="EmergencyEvent",
            entity_id=event.id,
            operator_id=staff_id,
        )
        notification_service.notify(
            db,
            recipient_id=booking.owner_id,
            type=NotificationType.EMERGENCY,
            title="緊急醫療事件",
            message=f"櫃台已為您的寵物觸發緊急醫療事件：{body.description}",
            booking_id=booking.id,
            mark_sent=True,
        )
        # In-house emergency ends the stay: abort + release beds (SDD §4.4 / §8).
        if booking.status in (BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS):
            assert_booking_transition(booking.status, BookingStatus.ABORTED)
            booking.status = BookingStatus.ABORTED
            res.release_booking_resources(db, booking, operator_id=staff_id)
        db.commit()
        db.refresh(event)
        return event


checkin_service = CheckInService()
