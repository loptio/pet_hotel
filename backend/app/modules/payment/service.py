"""PaymentService — internal module (no external router). S1 stub.

Called by Booking/Cancellation. Talks to ECPay (NFR-03: card data never stored).
Real charge/refund/idempotency logic is S2.
"""
from __future__ import annotations


class PaymentService:
    def charge(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-05.3 charge (deposit/final) via ECPay")

    def refund(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-05.4 refund via ECPay")


payment_service = PaymentService()
