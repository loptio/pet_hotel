"""Pet & Health Records schemas (Pydantic v2, camelCase)."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import Field

from app.common.schemas import CamelModel
from app.modules.pet.models import DangerLevel, VaccinationStatus


class PetOut(CamelModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    species: str | None = None
    breed: str | None = None
    birth_date: date | None = None
    chip_id: str | None = None
    behavior_note: str | None = None
    danger_level: DangerLevel
    danger_note: str | None = None
    is_blocked: bool
    created_at: datetime


class PetCreateIn(CamelModel):
    """FR-02.1 / 02.6 — basic profile + optional behaviour note."""

    name: str = Field(..., examples=["旺財"])
    species: str | None = Field(default=None, examples=["Dog"])
    breed: str | None = Field(default=None, examples=["柴犬"])
    birth_date: date | None = None
    chip_id: str | None = Field(default=None, examples=["900123456789012"])
    behavior_note: str | None = Field(default=None, examples=["怕生，不喜歡被碰腳"])


class PetUpdateIn(CamelModel):
    name: str | None = None
    species: str | None = None
    breed: str | None = None
    birth_date: date | None = None
    chip_id: str | None = None
    behavior_note: str | None = None


class MedicalRecordOut(CamelModel):
    id: uuid.UUID
    pet_id: uuid.UUID
    description: str
    created_at: datetime


class MedicalRecordCreateIn(CamelModel):
    """FR-02.2 — append only; never modified/deleted afterwards."""

    description: str = Field(..., examples=["2025 年曾因皮膚過敏就診"])


class VaccinationRecordOut(CamelModel):
    id: uuid.UUID
    pet_id: uuid.UUID
    vaccine_name: str
    administered_at: date | None = None
    expires_at: date | None = None
    status: VaccinationStatus
    verified_at: datetime | None = None
    verified_by_id: uuid.UUID | None = None


class VaccinationCreateIn(CamelModel):
    """FR-02.3 — owner pre-enters vaccine + expiry (optional data)."""

    vaccine_name: str = Field(..., examples=["狂犬病疫苗"])
    administered_at: date | None = None
    expires_at: date | None = Field(default=None, examples=["2026-12-31"])


class VaccineProofDocumentOut(CamelModel):
    id: uuid.UUID
    vaccination_record_id: uuid.UUID
    file_url: str
    uploaded_at: datetime | None = None


class DangerLevelMarkIn(CamelModel):
    """FR-02.7 — Staff/Groomer: Low/Medium; Admin: High. Note required."""

    danger_level: DangerLevel = Field(..., examples=[DangerLevel.MEDIUM])
    danger_note: str = Field(..., examples=["曾對工作人員低吼"])
