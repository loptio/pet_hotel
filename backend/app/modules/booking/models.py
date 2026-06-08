"""Booking & Service Execution package (class diagram §3) — booking side.

- ServiceItem is abstract with two subtypes (LodgingService / GroomingService).
  Modelled as single-table inheritance keyed on `category` (ServiceCategory);
  room_type / grooming_type are the subtype-specific columns.
- Kennel lives here (it is in the "Booking & Service Execution" package of the
  class diagram). Kennel-management *endpoints* are surfaced under the CheckIn
  router (front-desk domain).
- BookingStatus has 9 states, KennelStatus 4 (see SDD §4.4).
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin, UUIDPrimaryKey, pg_enum

CURRENCY_LEN = 3


class ServiceCategory(str, enum.Enum):
    LODGING = "Lodging"
    GROOMING = "Grooming"


class RoomType(str, enum.Enum):
    STANDARD = "Standard"
    DELUXE = "Deluxe"


class GroomingType(str, enum.Enum):
    BASIC = "Basic"
    FULL = "Full"


class KennelStatus(str, enum.Enum):
    AVAILABLE = "Available"
    RESERVED = "Reserved"
    OCCUPIED = "Occupied"
    CLEANING = "Cleaning"


class BookingStatus(str, enum.Enum):
    PENDING_DEPOSIT = "PendingDeposit"
    PENDING_REVIEW = "PendingReview"
    CONFIRMED = "Confirmed"
    CANCELLED = "Cancelled"
    CHECKED_IN = "CheckedIn"
    IN_PROGRESS = "InProgress"
    COMPLETED = "Completed"
    ABORTED = "Aborted"
    NO_SHOW = "NoShow"


# Shared enum-type instances (one CREATE TYPE each). RoomType is used by two
# columns (service_items.room_type + kennels.type), so the SAME instance must be
# reused or Postgres would attempt to create the type twice.
_room_type = pg_enum(RoomType, "room_type")
_service_category = pg_enum(ServiceCategory, "service_category")
_grooming_type = pg_enum(GroomingType, "grooming_type")
_kennel_status = pg_enum(KennelStatus, "kennel_status")
_booking_status = pg_enum(BookingStatus, "booking_status")


class ServiceItem(UUIDPrimaryKey, TimestampMixin, Base):
    """Abstract catalogue item (FR-03.7). Single-table inheritance on category."""

    __tablename__ = "service_items"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[ServiceCategory] = mapped_column(_service_category, nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(CURRENCY_LEN), default="TWD", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # subtype-specific (nullable on the shared table)
    room_type: Mapped[RoomType | None] = mapped_column(_room_type)
    grooming_type: Mapped[GroomingType | None] = mapped_column(_grooming_type)

    # Abstract base: no concrete identity of its own; subclasses declare theirs.
    __mapper_args__ = {
        "polymorphic_on": category,
        "with_polymorphic": "*",
    }


class LodgingService(ServiceItem):
    """Standard / Deluxe room (FR-03.7)."""

    __mapper_args__ = {"polymorphic_identity": ServiceCategory.LODGING}


class GroomingService(ServiceItem):
    """Basic / Full grooming (FR-03.7)."""

    __mapper_args__ = {"polymorphic_identity": ServiceCategory.GROOMING}


class Kennel(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "kennels"

    kennel_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    type: Mapped[RoomType] = mapped_column(_room_type, nullable=False)
    status: Mapped[KennelStatus] = mapped_column(
        _kennel_status, default=KennelStatus.AVAILABLE, nullable=False
    )


class Booking(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "bookings"

    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        _booking_status,
        default=BookingStatus.PENDING_DEPOSIT,
        nullable=False,
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    deposit_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(CURRENCY_LEN), default="TWD", nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["BookingItem"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )
    booked_pets: Mapped[list["BookedPet"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )
    resource_allocations: Mapped[list["ResourceAllocation"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )


class BookedPet(UUIDPrimaryKey, TimestampMixin, Base):
    """Intermediary Booking ⇆ Pet; optionally assigned to a Kennel."""

    __tablename__ = "booked_pets"

    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    pet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pets.id"), nullable=False)
    kennel_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("kennels.id"))

    booking: Mapped["Booking"] = relationship(back_populates="booked_pets")


class BookingItem(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "booking_items"

    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    service_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_items.id"), nullable=False
    )
    booked_pet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("booked_pets.id"), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(CURRENCY_LEN), default="TWD", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="items")


class AvailabilitySlot(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "availability_slots"

    service_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_items.id"), nullable=False
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)


class ResourceAllocation(UUIDPrimaryKey, TimestampMixin, Base):
    """Records a locked resource (kennel/slot) for a booking (FR-03.2). The
    Redis distributed lock itself is S2; this is the durable DB-side record."""

    __tablename__ = "resource_allocations"

    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(40), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(64), nullable=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    booking: Mapped["Booking"] = relationship(back_populates="resource_allocations")
