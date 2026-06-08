"""Grooming / work-order schemas (Pydantic v2, camelCase)."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pydantic import Field

from app.common.schemas import CamelModel
from app.modules.grooming.models import WorkStatus


class GroomingStage(str, enum.Enum):
    """The 4 advanceable stages (FR-04.5) — a subset of WorkStatus used as the
    request body for stage updates."""

    PRE_CHECK = "PreCheck"
    BATHING = "Bathing"
    DRYING = "Drying"
    GROOMING = "Grooming"


class WorkOrderOut(CamelModel):
    id: uuid.UUID
    booking_item_id: uuid.UUID
    assigned_to_id: uuid.UUID
    status: WorkStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class WorkPhotoOut(CamelModel):
    id: uuid.UUID
    work_order_id: uuid.UUID
    url: str
    uploaded_at: datetime | None = None


class EmergencyEventOut(CamelModel):
    """Booking-layer event (SDD §8). workOrderId is set only for grooming-stage
    emergencies; NULL for front-desk/lodging ones."""

    id: uuid.UUID
    booking_id: uuid.UUID
    pet_id: uuid.UUID
    work_order_id: uuid.UUID | None = None
    reported_by_id: uuid.UUID
    description: str
    occurred_at: datetime | None = None


class WorkOrderDetailOut(WorkOrderOut):
    photos: list[WorkPhotoOut] = Field(default_factory=list)
    emergency_event: EmergencyEventOut | None = None


class StageUpdateIn(CamelModel):
    stage: GroomingStage = Field(..., examples=[GroomingStage.BATHING])


class EmergencyTriggerIn(CamelModel):
    """FR-06.3 — description is mandatory."""

    description: str = Field(..., min_length=1, examples=["寵物突發抽搐，已送醫"])
