"""Manual no-show sweep (FR-03.5) — demo trigger.

The build plan makes no-show a manually-triggered action (no resident scheduler).
The frozen S1 contract has NO no-show endpoint, so per "report contract changes,
don't sneak them" this is a CLI script rather than a new route: it marks every
Confirmed booking whose start time is >2h past as NoShow and releases its
resources, inside one transaction. (Recommendation to expose a staff endpoint is
reported to the command side.)

    cd backend && .venv/bin/python scripts/no_show_sweep.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.db.base  # noqa: E402,F401  (register all models before mapper config)
from app.core.database import SessionLocal  # noqa: E402
from app.modules.booking.service import booking_service  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        swept = booking_service.mark_no_shows(db)
    finally:
        db.close()
    print(f"No-show sweep complete: {swept} booking(s) marked NoShow + resources released.")


if __name__ == "__main__":
    main()
