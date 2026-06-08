"""Audit package (class diagram §4) — internal module (no external router).

AuditLog is a standalone, polymorphic, APPEND-ONLY entity (FR-05.2): not owned
by any aggregate; entityType + entityId reference Booking / WorkOrder /
PaymentTransaction / EmergencyEvent / Pet / Kennel. A DB trigger (see the
Alembic migration) rejects UPDATE/DELETE so logs are immutable.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, CreatedAtMixin, UUIDPrimaryKey, pg_enum


class AuditActionType(str, enum.Enum):
    BOOKING_CREATED = "BookingCreated"
    BOOKING_CANCELLED = "BookingCancelled"
    CHECK_IN_SUCCESS = "CheckInSuccess"
    CHECK_IN_BLOCKED = "CheckInBlocked"
    SERVICE_STATUS_CHANGED = "ServiceStatusChanged"
    PAYMENT_PROCESSED = "PaymentProcessed"
    EMERGENCY_TRIGGERED = "EmergencyTriggered"
    DANGER_LEVEL_UPDATED = "DangerLevelUpdated"
    KENNEL_STATUS_CHANGED = "KennelStatusChanged"


class AuditLog(UUIDPrimaryKey, CreatedAtMixin, Base):
    __tablename__ = "audit_logs"

    action_type: Mapped[AuditActionType] = mapped_column(
        pg_enum(AuditActionType, "audit_action_type"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    operator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
