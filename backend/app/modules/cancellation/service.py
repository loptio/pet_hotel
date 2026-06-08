"""CancellationService — S1 stub (gateway-exposed). Real logic in S2.

Service-only module: it has NO own entities, operating over Booking +
PaymentTransaction. Validates cancellable state, releases resources, applies the
FR-05.4 24-hour refund rule via PaymentService → ECPay (seq4).
"""
from __future__ import annotations


class CancellationService:
    def cancel_booking(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-03.3/05.4 cancel + 24h refund rule")


cancellation_service = CancellationService()
