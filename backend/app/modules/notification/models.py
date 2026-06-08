"""Notification package (class diagram §4) — internal module (no external
router). Delivery is async via RabbitMQ → FCM/APNs (wired in S4)."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin, UUIDPrimaryKey, pg_enum


class NotificationType(str, enum.Enum):
    BOOKING_CREATED = "BookingCreated"
    CHECK_IN_SUCCESS = "CheckInSuccess"
    VACCINE_EXPIRED = "VaccineExpired"
    SERVICE_STAGE_UPDATED = "ServiceStageUpdated"
    SERVICE_COMPLETED = "ServiceCompleted"
    EMERGENCY = "Emergency"


class NotificationStatus(str, enum.Enum):
    PENDING = "Pending"
    SENT = "Sent"
    FAILED = "Failed"


class Notification(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bookings.id"))
    type: Mapped[NotificationType] = mapped_column(
        pg_enum(NotificationType, "notification_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[NotificationStatus] = mapped_column(
        pg_enum(NotificationStatus, "notification_status"),
        default=NotificationStatus.PENDING,
        nullable=False,
    )
