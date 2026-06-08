"""BookingService — S1 stub (gateway-exposed). Real logic in S2.

Orchestrates danger-level gating (FR-02.8), availability + resource locking
(FR-03.2, Redis lock is S2), deposit charging via PaymentService (FR-05.3), and
staff review of PendingReview bookings (seq5). State transitions are S2.
"""
from __future__ import annotations


class BookingService:
    def check_availability(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-03.2/06.2 availability")

    def create_booking(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-03.1 create booking + danger gating")

    def pay_deposit(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-05.3 deposit (30%) + confirm")

    def pay_final(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-05.3 final payment")

    def list_bookings(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-03.4 list/history")

    def list_pending_review(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-02.8 pending-review list")

    def review_booking(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-02.8 review (approve/reject)")


booking_service = BookingService()
