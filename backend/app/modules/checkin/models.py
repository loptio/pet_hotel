"""Check-in package (class diagram §3 — execution side).

CheckIn is owned 0..1 by a Booking; handledBy → Staff account.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin, UUIDPrimaryKey, pg_enum


class CheckInResult(str, enum.Enum):
    SUCCESS = "Success"
    BLOCKED = "Blocked"


class CheckIn(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "check_ins"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), nullable=False, unique=True
    )
    handled_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[CheckInResult] = mapped_column(
        pg_enum(CheckInResult, "checkin_result"), nullable=False
    )
