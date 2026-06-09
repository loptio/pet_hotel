"""PetService — pet profiles + health records (FR-02.*).

Owner-facing CRUD plus staff/admin danger-level control. Ownership is enforced
here (an owner only ever touches their own pets; staff/admin may read any pet and
mark danger). Append-only invariants (FR-02.2 medical records, vaccine proof) are
preserved by never exposing update/delete and by rejecting proof overwrites.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ROLE_ADMIN, STAFF_ROLES, Principal
from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.pet import schemas as s
from app.modules.pet.models import (
    DangerLevel,
    MedicalRecord,
    Pet,
    VaccinationRecord,
    VaccineProofDocument,
)

ALLOWED_PROOF_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class PetService:
    # ----- internal helpers -----
    def _owned_pet_or_404(self, db: Session, pet_id: uuid.UUID, owner_id: uuid.UUID) -> Pet:
        """A pet the caller owns. Returns 404 (not 403) for someone else's pet so
        existence isn't leaked across owners."""
        pet = db.get(Pet, pet_id)
        if pet is None or pet.owner_id != owner_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
        return pet

    def _readable_pet_or_404(self, db: Session, pet_id: uuid.UUID, principal: Principal) -> Pet:
        """Readable if the caller owns it or is staff/admin."""
        pet = db.get(Pet, pet_id)
        if pet is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
        if pet.owner_id != principal.account_id and not (principal.roles & STAFF_ROLES):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
        return pet

    def _pet_or_404(self, db: Session, pet_id: uuid.UUID) -> Pet:
        pet = db.get(Pet, pet_id)
        if pet is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pet not found")
        return pet

    # ----- FR-02.1 / 02.6 profile -----
    def create_pet(self, db: Session, owner_id: uuid.UUID, body: s.PetCreateIn) -> Pet:
        pet = Pet(
            owner_id=owner_id,
            name=body.name,
            species=body.species,
            breed=body.breed,
            birth_date=body.birth_date,
            chip_id=body.chip_id,
            behavior_note=body.behavior_note,
            danger_level=DangerLevel.NONE,
            is_blocked=False,
        )
        db.add(pet)
        db.commit()
        db.refresh(pet)
        return pet

    def list_pets(self, db: Session, principal: Principal) -> list[Pet]:
        """Owner sees their own pets; staff (FrontDesk/Groomer/Admin) see all —
        needed so the admin danger-pets page can list every pet. Same path /
        params / response (PetOut[]) as the frozen contract (S3b behaviour fix,
        mirrors the staff-aware list_bookings)."""
        stmt = select(Pet)
        if not (principal.roles & STAFF_ROLES):
            stmt = stmt.where(Pet.owner_id == principal.account_id)
        return list(db.execute(stmt.order_by(Pet.created_at)).scalars().all())

    def update_pet(
        self, db: Session, pet_id: uuid.UUID, owner_id: uuid.UUID, body: s.PetUpdateIn
    ) -> Pet:
        pet = self._owned_pet_or_404(db, pet_id, owner_id)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(pet, field, value)
        db.commit()
        db.refresh(pet)
        return pet

    # ----- FR-02.2 medical records (append-only) -----
    def add_medical_record(
        self, db: Session, pet_id: uuid.UUID, owner_id: uuid.UUID, body: s.MedicalRecordCreateIn
    ) -> MedicalRecord:
        self._owned_pet_or_404(db, pet_id, owner_id)
        record = MedicalRecord(pet_id=pet_id, description=body.description)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def list_medical_records(
        self, db: Session, pet_id: uuid.UUID, principal: Principal
    ) -> list[MedicalRecord]:
        self._readable_pet_or_404(db, pet_id, principal)
        return list(
            db.execute(
                select(MedicalRecord)
                .where(MedicalRecord.pet_id == pet_id)
                .order_by(MedicalRecord.created_at)
            ).scalars().all()
        )

    # ----- FR-02.3 / 02.4 vaccinations + proof -----
    def add_vaccination(
        self, db: Session, pet_id: uuid.UUID, owner_id: uuid.UUID, body: s.VaccinationCreateIn
    ) -> VaccinationRecord:
        self._owned_pet_or_404(db, pet_id, owner_id)
        record = VaccinationRecord(
            pet_id=pet_id,
            vaccine_name=body.vaccine_name,
            administered_at=body.administered_at,
            expires_at=body.expires_at,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def list_vaccinations(
        self, db: Session, pet_id: uuid.UUID, principal: Principal
    ) -> list[VaccinationRecord]:
        self._readable_pet_or_404(db, pet_id, principal)
        return list(
            db.execute(
                select(VaccinationRecord)
                .where(VaccinationRecord.pet_id == pet_id)
                .order_by(VaccinationRecord.created_at)
            ).scalars().all()
        )

    def upload_vaccine_proof(
        self,
        db: Session,
        pet_id: uuid.UUID,
        vaccination_id: uuid.UUID,
        owner_id: uuid.UUID,
        file: UploadFile,
    ) -> VaccineProofDocument:
        self._owned_pet_or_404(db, pet_id, owner_id)
        vaccination = db.get(VaccinationRecord, vaccination_id)
        if vaccination is None or vaccination.pet_id != pet_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Vaccination record not found")
        # Append-only: one proof per vaccination, never overwritten (FR-02.4 red line).
        if vaccination.proof_document is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Proof already uploaded for this vaccination"
            )

        ext = ALLOWED_PROOF_TYPES.get(file.content_type or "")
        if ext is None:
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "Proof must be a PDF or image (pdf/jpeg/png/webp)",
            )
        content = file.file.read()
        if not content:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"File exceeds {settings.max_upload_bytes} bytes",
            )

        # Local filesystem for S2a (object storage is S4). Filename is derived
        # from the vaccination id — no user-controlled path component.
        rel_path = f"vaccine_proofs/{vaccination_id}{ext}"
        dest = Path(settings.upload_dir) / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)

        doc = VaccineProofDocument(
            vaccination_record_id=vaccination_id,
            file_url=rel_path,
            uploaded_at=func.now(),
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    # ----- FR-02.7 danger level + block/unblock -----
    def mark_danger_level(
        self, db: Session, pet_id: uuid.UUID, principal: Principal, body: s.DangerLevelMarkIn
    ) -> Pet:
        """Low/Medium: FrontDesk/Groomer/Admin. High: Admin only (and auto-blocks
        the pet, FR-02.7/02.8). A pet that is already blocked can only be modified
        by an Admin, so staff can't quietly downgrade a high-risk pet."""
        pet = self._pet_or_404(db, pet_id)
        is_admin = ROLE_ADMIN in principal.roles

        if body.danger_level == DangerLevel.HIGH and not is_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Only an Admin can mark High danger level"
            )
        if pet.is_blocked and not is_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "A blocked pet can only be modified by an Admin"
            )

        pet.danger_level = body.danger_level
        pet.danger_note = body.danger_note
        if body.danger_level == DangerLevel.HIGH:
            # Auto-block (FR-02.8): blocked pets are rejected at booking (S2b gates
            # on is_blocked; an Admin must /unblock to allow booking again).
            pet.is_blocked = True

        audit_service.audit(
            db,
            action_type=AuditActionType.DANGER_LEVEL_UPDATED,
            entity_type="Pet",
            entity_id=pet.id,
            operator_id=principal.account_id,
        )
        db.commit()
        db.refresh(pet)
        return pet

    def unblock_pet(self, db: Session, pet_id: uuid.UUID, operator_id: uuid.UUID) -> Pet:
        """Admin-only. Clears the block so the pet can be booked again (FR-02.8).
        danger_level is left as the historical record; the booking gate keys on
        is_blocked, not on the level."""
        pet = self._pet_or_404(db, pet_id)
        pet.is_blocked = False
        audit_service.audit(
            db,
            action_type=AuditActionType.DANGER_LEVEL_UPDATED,
            entity_type="Pet",
            entity_id=pet.id,
            operator_id=operator_id,
        )
        db.commit()
        db.refresh(pet)
        return pet


pet_service = PetService()
