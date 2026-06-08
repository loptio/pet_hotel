"""PaymentService — internal module (no external router).

Called by Booking / Cancellation. Talks to a *sandbox* ECPay adapter: the demo
does not contact a real gateway, so authorize / capture / refund always succeed
and return a fake provider transaction id. NFR-03 (red line): card data never
enters the system — the adapter takes only an amount + a PaymentMethod
(Online / CardOnSite, no card number) and we persist only the provider txn id on
the PaymentTransaction (FR-05.1 records amount, method, status, timestamp).

Every charge/refund is written as a PaymentTransaction *and* audited
(PaymentProcessed, FR-05.2) inside the caller's transaction, so payment state and
the triggering booking/resource state commit or roll back together (NFR-04).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.payment.models import (
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    PaymentTransaction,
    PaymentType,
)


class FakeECPayAdapter:
    """Sandbox ECPay. authorize+capture+refund are stubbed to always succeed and
    return an opaque provider reference. No card data is accepted or stored
    (NFR-03) — only the amount and the chosen method flow through."""

    def authorize(self, amount: Decimal, method: PaymentMethod) -> str:
        return f"ECPAY-AUTH-{uuid.uuid4().hex[:16]}"

    def capture(self, provider_txn_id: str) -> bool:
        return True

    def refund(self, amount: Decimal, original_txn_id: str | None) -> str:
        return f"ECPAY-RFND-{uuid.uuid4().hex[:16]}"


class PaymentService:
    def __init__(self, adapter: FakeECPayAdapter | None = None) -> None:
        self._adapter = adapter or FakeECPayAdapter()

    def charge(
        self,
        db: Session,
        booking_id: uuid.UUID,
        payment_type: PaymentType,
        method: PaymentMethod,
        amount: Decimal,
        currency: str = "TWD",
        operator_id: uuid.UUID | None = None,
    ) -> PaymentTransaction:
        """Authorize + capture a deposit / final payment (FR-05.3). Demo: one
        step → Authorized. Flushed into the caller's transaction."""
        provider_txn_id = self._adapter.authorize(amount, method)
        self._adapter.capture(provider_txn_id)
        txn = PaymentTransaction(
            booking_id=booking_id,
            type=payment_type,
            method=method,
            amount=amount,
            currency=currency,
            status=PaymentStatus.AUTHORIZED,
            provider=PaymentProvider.ECPAY,
            provider_txn_id=provider_txn_id,
        )
        db.add(txn)
        db.flush()
        audit_service.audit(
            db,
            action_type=AuditActionType.PAYMENT_PROCESSED,
            entity_type="PaymentTransaction",
            entity_id=txn.id,
            operator_id=operator_id,
        )
        return txn

    def refund(
        self,
        db: Session,
        booking_id: uuid.UUID,
        amount: Decimal,
        currency: str = "TWD",
        method: PaymentMethod = PaymentMethod.ONLINE,
        original_txn_id: str | None = None,
        operator_id: uuid.UUID | None = None,
    ) -> PaymentTransaction:
        """Refund a deposit on cancellation (FR-05.4). Demo: always succeeds →
        Refunded. Flushed into the caller's transaction."""
        provider_txn_id = self._adapter.refund(amount, original_txn_id)
        txn = PaymentTransaction(
            booking_id=booking_id,
            type=PaymentType.REFUND,
            method=method,
            amount=amount,
            currency=currency,
            status=PaymentStatus.REFUNDED,
            provider=PaymentProvider.ECPAY,
            provider_txn_id=provider_txn_id,
        )
        db.add(txn)
        db.flush()
        audit_service.audit(
            db,
            action_type=AuditActionType.PAYMENT_PROCESSED,
            entity_type="PaymentTransaction",
            entity_id=txn.id,
            operator_id=operator_id,
        )
        return txn


payment_service = PaymentService()
