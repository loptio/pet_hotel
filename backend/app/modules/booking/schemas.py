"""Booking schemas (Pydantic v2, camelCase).

Payment outcomes are surfaced inline (PaymentResultOut) since PaymentService is
internal — the booking flow returns its own payment result, not a payment CRUD.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pydantic import Field

from app.common.schemas import CamelModel, Money
from app.modules.booking.models import (
    BookingStatus,
    GroomingType,
    RoomType,
    ServiceCategory,
)
from app.modules.payment.models import PaymentMethod, PaymentStatus, PaymentType


# ----- catalogue / availability -----
class ServiceItemOut(CamelModel):
    id: uuid.UUID
    name: str
    category: ServiceCategory
    base_price: Money
    duration_minutes: int
    room_type: RoomType | None = None
    grooming_type: GroomingType | None = None
    is_active: bool


class AvailabilitySlotOut(CamelModel):
    id: uuid.UUID
    service_item_id: uuid.UUID
    start_at: datetime
    end_at: datetime
    capacity: int


class AvailabilityOut(CamelModel):
    """FR-03.2 / FR-06.2 — only currently-available slots are returned."""

    available: bool
    slots: list[AvailabilitySlotOut] = Field(default_factory=list)


# ----- create -----
class BookingItemIn(CamelModel):
    service_item_id: uuid.UUID
    pet_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)


class BookingCreateIn(CamelModel):
    """FR-03.1 — choose pet(s), service(s) and a time window. Danger gating
    (FR-02.8) decides the resulting status (PendingDeposit / PendingReview) or a
    409 rejection when the pet's danger level is High."""

    start_at: datetime
    end_at: datetime
    items: list[BookingItemIn] = Field(..., min_length=1)


# ----- read -----
class BookedPetOut(CamelModel):
    id: uuid.UUID
    pet_id: uuid.UUID
    kennel_id: uuid.UUID | None = None


class BookingItemOut(CamelModel):
    id: uuid.UUID
    service_item_id: uuid.UUID
    booked_pet_id: uuid.UUID
    unit_price: Money
    quantity: int


class BookingOut(CamelModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    status: BookingStatus
    start_at: datetime
    end_at: datetime
    total_amount: Money
    deposit_amount: Money
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None
    created_at: datetime


class BookingDetailOut(BookingOut):
    items: list[BookingItemOut] = Field(default_factory=list)
    booked_pets: list[BookedPetOut] = Field(default_factory=list)


# ----- payment (inline outcome) -----
class PaymentResultOut(CamelModel):
    transaction_id: uuid.UUID
    type: PaymentType
    method: PaymentMethod
    amount: Money
    status: PaymentStatus


class DepositPaymentIn(CamelModel):
    """FR-05.3 — deposit = 30% of estimated total."""

    payment_method: PaymentMethod = Field(..., examples=[PaymentMethod.ONLINE])


class FinalPaymentIn(CamelModel):
    payment_method: PaymentMethod = Field(..., examples=[PaymentMethod.CARD_ON_SITE])


class BookingPaymentResultOut(CamelModel):
    booking: BookingOut
    payment: PaymentResultOut


# ----- staff review (seq5) -----
class ReviewDecision(str, enum.Enum):
    APPROVED = "Approved"
    REJECTED = "Rejected"


class ReviewIn(CamelModel):
    decision: ReviewDecision
    staff_note: str | None = Field(default=None, examples=["已電話確認，核可"])
