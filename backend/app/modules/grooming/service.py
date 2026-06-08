"""GroomingService — S1 stub (gateway-exposed). Real logic in S2.

Drives the WorkOrder state machine (Pending→PreCheck→Bathing→Drying→Grooming→
Completed; any stage → Aborted on emergency, FR-06.3), photo uploads (FR-04.2),
and per-stage owner notifications (FR-04.5, seq3).
"""
from __future__ import annotations


class GroomingService:
    def list_work_orders(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: list work orders")

    def get_work_order(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-04.4 work order detail")

    def start_work_order(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: start work order (Pending→PreCheck)")

    def update_stage(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-04.5 update stage + notify")

    def upload_photo(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-04.2 upload work photo")

    def complete(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: complete work order")

    def trigger_emergency(self, *a, **k):  # pragma: no cover - S2
        raise NotImplementedError("S2: FR-06.3 trigger emergency (→Aborted)")


grooming_service = GroomingService()
