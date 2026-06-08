"""CancellationService — gateway-exposed (CancellationService).

Service-only module (no own entities): operates over Booking + PaymentTransaction
(seq4). Validates a cancellable state, applies the FR-05.4 24-hour refund rule,
issues the refund through PaymentService → sandbox ECPay, releases the booking's
resources, and records the cancellation (FR-03.3 / NFR-05 reason retained).

24h rule (FR-05.4): cancel ≥24h before start → full deposit refund; <24h (or a
no-show) → no refund. A booking with no deposit yet (PendingDeposit /
PendingReview) has nothing to refund.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.schemas import Money
from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.booking import mappers as m
from app.modules.booking import resources as res
from app.modules.booking.models import Booking, BookingStatus
from app.modules.booking.state import assert_booking_transition
from app.modules.cancellation import schemas as s
from app.modules.payment.models import PaymentMethod, PaymentTransaction, PaymentType
from app.modules.payment.service import payment_service

CANCEL_FULL_REFUND_WINDOW = timedelta(hours=24)  # FR-05.4
CANCELLABLE = {BookingStatus.PENDING_DEPOSIT, BookingStatus.PENDING_REVIEW, BookingStatus.CONFIRMED}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CancellationService:
    def _deposit_method(self, db: Session, booking_id: uuid.UUID) -> PaymentMethod:
        txn = db.execute(
            select(PaymentTransaction)
            .where(
                PaymentTransaction.booking_id == booking_id,
                PaymentTransaction.type == PaymentType.DEPOSIT,
            )
            .order_by(PaymentTransaction.created_at.desc())
        ).scalars().first()
        return txn.method if txn is not None else PaymentMethod.ONLINE

    def cancel_booking(
        self, db: Session, owner_id: uuid.UUID, booking_id: uuid.UUID, body: s.CancelBookingIn
    ) -> s.CancellationResultOut:
        booking = db.get(Booking, booking_id)
        if booking is None or booking.owner_id != owner_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        if booking.status not in CANCELLABLE:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Booking cannot be cancelled in status {booking.status.value}",
            )

        deposit_paid = booking.status == BookingStatus.CONFIRMED
        within_full_refund = _now() <= booking.start_at - CANCEL_FULL_REFUND_WINDOW

        # Decide the refund before mutating state.
        if not deposit_paid:
            refund = s.RefundOut(
                eligible=False, status=None, amount=None,
                reason="尚未支付訂金，無需退款。",
            )
        elif within_full_refund:
            refund = s.RefundOut(
                eligible=True, status=None, amount=None,
                reason="取消時間距開始 ≥ 24 小時，全額退還訂金。",
            )
        else:
            refund = s.RefundOut(
                eligible=False, status=None, amount=None,
                reason="取消時間距開始 < 24 小時，訂金不予退還（FR-05.4）。",
            )

        # Transition + release resources.
        assert_booking_transition(booking.status, BookingStatus.CANCELLED)
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = _now()
        booking.cancel_reason = body.reason
        res.release_booking_resources(db, booking, operator_id=owner_id)
        audit_service.audit(
            db,
            action_type=AuditActionType.BOOKING_CANCELLED,
            entity_type="Booking",
            entity_id=booking.id,
            operator_id=owner_id,
        )

        # Issue the refund (sandbox ECPay) if eligible.
        if refund.eligible:
            rtxn = payment_service.refund(
                db,
                booking_id=booking.id,
                amount=booking.deposit_amount,
                currency=booking.currency,
                method=self._deposit_method(db, booking.id),
                operator_id=owner_id,
            )
            refund.status = rtxn.status
            refund.amount = Money(amount=rtxn.amount, currency=rtxn.currency)

        db.commit()
        db.refresh(booking)
        return s.CancellationResultOut(booking=m.booking_out(booking), refund=refund)


cancellation_service = CancellationService()
