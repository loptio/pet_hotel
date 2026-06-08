"""Check-in + kennel schemas (Pydantic v2, camelCase)."""
from __future__ import annotations

import uuid
from datetime import date

from pydantic import Field

from app.common.schemas import CamelModel
from app.modules.booking.models import BookingStatus, KennelStatus, RoomType
from app.modules.checkin.models import CheckInResult


class CheckInRequestIn(CamelModel):
    """seq2 — scan chip / enter booking id."""

    booking_id: uuid.UUID
    chip_id: str = Field(..., examples=["900123456789012"])


class CheckInResultOut(CamelModel):
    """result=Success → kennelNumber for lodging; result=Blocked → reason
    (e.g. VaccineExpired, FR-06.1)."""

    booking_id: uuid.UUID
    result: CheckInResult
    reason: str | None = Field(default=None, examples=["VaccineExpired"])
    kennel_number: str | None = Field(default=None, examples=["A-12"])


class BookingVerifyOut(CamelModel):
    """FR-04.1 — front-desk verifies booking status before check-in."""

    booking_id: uuid.UUID
    status: BookingStatus
    valid: bool
    message: str | None = None


class VaccineRecordAtCounterIn(CamelModel):
    """FR-02.5 — staff records the vaccine at check-in; system auto-verifies
    expiry (FR-06.1)."""

    pet_id: uuid.UUID
    vaccine_name: str = Field(..., examples=["狂犬病疫苗"])
    administered_at: date | None = None
    expires_at: date = Field(..., examples=["2026-12-31"])


class KennelOut(CamelModel):
    """FR-03.6 — also surfaces which pet currently occupies the kennel."""

    id: uuid.UUID
    kennel_number: str
    type: RoomType
    status: KennelStatus
    occupied_by_pet_id: uuid.UUID | None = None
    occupied_by_pet_name: str | None = None
    occupied_by_booking_id: uuid.UUID | None = None


class KennelUpdateIn(CamelModel):
    """FR-06.4 — staff updates kennel status (e.g. Cleaning → Available)."""

    status: KennelStatus = Field(..., examples=[KennelStatus.AVAILABLE])


class EmergencyAtCounterIn(CamelModel):
    """FR-06.3 / SDD §8 — front-desk triggers an emergency for a booked pet.
    A booking may include several pets, so pet_id identifies which one;
    description is mandatory. (Lodging emergencies have no work order.)"""

    pet_id: uuid.UUID
    description: str = Field(..., min_length=1, examples=["住宿寵物突發嘔吐，已聯絡飼主"])
