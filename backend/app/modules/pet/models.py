"""Pet & Health Records package (class diagram §2).

MedicalRecord is append-only (FR-02.2 — may add, never modify/delete), so it
uses CreatedAtMixin (no updated_at). dangerLevel defaults to None per the
DangerLevel enum.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKey, pg_enum


class DangerLevel(str, enum.Enum):
    NONE = "None"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class VaccinationStatus(str, enum.Enum):
    PENDING = "Pending"
    VALID = "Valid"
    EXPIRED = "Expired"
    REJECTED = "Rejected"


class Pet(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "pets"

    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    species: Mapped[str | None] = mapped_column(String(60))
    breed: Mapped[str | None] = mapped_column(String(80))
    birth_date: Mapped[date | None] = mapped_column(Date)
    chip_id: Mapped[str | None] = mapped_column(String(40), index=True)
    behavior_note: Mapped[str | None] = mapped_column(Text)
    danger_level: Mapped[DangerLevel] = mapped_column(
        pg_enum(DangerLevel, "danger_level"), default=DangerLevel.NONE, nullable=False
    )
    danger_note: Mapped[str | None] = mapped_column(Text)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner: Mapped["Account"] = relationship(back_populates="pets")  # noqa: F821
    vaccination_records: Mapped[list["VaccinationRecord"]] = relationship(
        back_populates="pet", cascade="all, delete-orphan"
    )
    medical_records: Mapped[list["MedicalRecord"]] = relationship(
        back_populates="pet", cascade="all, delete-orphan"
    )


class VaccinationRecord(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "vaccination_records"

    pet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pets.id"), nullable=False)
    vaccine_name: Mapped[str] = mapped_column(String(120), nullable=False)
    administered_at: Mapped[date | None] = mapped_column(Date)
    expires_at: Mapped[date | None] = mapped_column(Date)
    status: Mapped[VaccinationStatus] = mapped_column(
        pg_enum(VaccinationStatus, "vaccination_status"),
        default=VaccinationStatus.PENDING,
        nullable=False,
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # verifiedBy → Staff account (class diagram)
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"))

    pet: Mapped["Pet"] = relationship(back_populates="vaccination_records")
    proof_document: Mapped["VaccineProofDocument | None"] = relationship(
        back_populates="vaccination_record", cascade="all, delete-orphan", uselist=False
    )


class VaccineProofDocument(UUIDPrimaryKey, CreatedAtMixin, Base):
    """Binary lives in object storage (S4); DB keeps metadata + URL only."""

    __tablename__ = "vaccine_proof_documents"

    vaccination_record_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vaccination_records.id"), nullable=False, unique=True
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    vaccination_record: Mapped["VaccinationRecord"] = relationship(back_populates="proof_document")


class MedicalRecord(UUIDPrimaryKey, CreatedAtMixin, Base):
    """Append-only (FR-02.2). No updated_at — records are never modified."""

    __tablename__ = "medical_records"

    pet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pets.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    pet: Mapped["Pet"] = relationship(back_populates="medical_records")
