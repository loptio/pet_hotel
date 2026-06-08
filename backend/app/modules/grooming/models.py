"""Grooming / Service Execution package (class diagram §3).

WorkOrder belongs to a BookingItem (0..1), assignedTo → Groomer account, holds
WorkPhotos and at most one EmergencyEvent. WorkStatus has 7 states (SDD §4.4).
WorkPhoto / EmergencyEvent are append-only (created_at only).
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKey, pg_enum


class WorkStatus(str, enum.Enum):
    PENDING = "Pending"
    PRE_CHECK = "PreCheck"
    BATHING = "Bathing"
    DRYING = "Drying"
    GROOMING = "Grooming"
    COMPLETED = "Completed"
    ABORTED = "Aborted"


class WorkOrder(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "work_orders"

    booking_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("booking_items.id"), nullable=False, unique=True
    )
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    status: Mapped[WorkStatus] = mapped_column(
        pg_enum(WorkStatus, "work_status"), default=WorkStatus.PENDING, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    photos: Mapped[list["WorkPhoto"]] = relationship(
        back_populates="work_order", cascade="all, delete-orphan"
    )
    # Optional reverse of EmergencyEvent.duringStage. NOT a composition anymore —
    # the event is owned by Booking (SDD §8), so no cascade here.
    emergency_event: Mapped["EmergencyEvent | None"] = relationship(
        back_populates="work_order", uselist=False
    )


class WorkPhoto(UUIDPrimaryKey, CreatedAtMixin, Base):
    """Binary in object storage (S4); DB keeps URL + metadata."""

    __tablename__ = "work_photos"

    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    work_order: Mapped["WorkOrder"] = relationship(back_populates="photos")


class EmergencyEvent(UUIDPrimaryKey, CreatedAtMixin, Base):
    """FR-06.3 — Booking-layer event (SDD §8). Triggered by front-desk OR
    groomer; lodging pets (no WorkOrder) can also be recorded.

    - booking_id (required): the booking it belongs to (Booking *-- EmergencyEvent).
    - pet_id (required): which pet it is about.
    - work_order_id (optional, unique): the grooming stage it occurred during
      (duringStage); NULL for lodging/front-desk emergencies.
    - reported_by_id (required): Staff/Groomer account.
    description is mandatory.
    """

    __tablename__ = "emergency_events"

    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    pet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pets.id"), nullable=False)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("work_orders.id"), unique=True
    )
    reported_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    work_order: Mapped["WorkOrder | None"] = relationship(back_populates="emergency_event")
