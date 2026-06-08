"""CheckInService — S1 stub (gateway-exposed). Real logic in S2.

Validates booking + chip (seq2), records + verifies vaccination (FR-02.5/06.1),
assigns a kennel for lodging (FR-03.6), drives Booking→CheckedIn and the kennel
state machine (FR-06.4). Kennel listing/marking are surfaced here (front-desk).
"""
from __future__ import annotations


class CheckInService:
    def check_in(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-04.1 check-in (booking+chip+vaccine)")

    def verify_booking(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-04.1 verify booking status")

    def record_vaccine(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-02.5 record vaccine + verify expiry")

    def check_out(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-06.4 check-out → kennel Cleaning")

    def list_kennels(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-03.6 list kennels + occupancy")

    def update_kennel(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-06.4 update kennel status")


checkin_service = CheckInService()
