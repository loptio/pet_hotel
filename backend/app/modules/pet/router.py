"""Pets & Health router — owner-facing resource group "Pets & Health".

FR-02.*: pet profile CRUD, append-only medical records, vaccination pre-entry +
proof upload, danger-level marking, admin unblock. RBAC:
- owner-only writes (create/edit/medical/vaccination/proof) on the caller's own pets;
- owner-or-staff reads of a single pet;
- danger-level marking by FrontDesk/Groomer (Low/Medium) or Admin (High, auto-blocks);
- unblock by Admin only.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import Principal, get_current_principal, require_roles
from app.modules.pet import schemas as s
from app.modules.pet.service import pet_service

router = APIRouter(prefix="/pets", tags=["Pets & Health"])

owner_only = Depends(require_roles("Owner"))
staff_danger = Depends(require_roles("FrontDesk", "Groomer", "Admin"))
admin_only = Depends(require_roles("Admin"))
authenticated = Depends(get_current_principal)


# ----- pet profile (FR-02.1 / 02.6) -----
@router.post("", response_model=s.PetOut, status_code=status.HTTP_201_CREATED,
             summary="Create a pet profile (FR-02.1)")
def create_pet(body: s.PetCreateIn, principal: Principal = owner_only, db: Session = Depends(get_db)):
    return pet_service.create_pet(db, principal.account_id, body)


@router.get("", response_model=list[s.PetOut], summary="List my pets (FR-02.1)")
def list_pets(principal: Principal = owner_only, db: Session = Depends(get_db)):
    return pet_service.list_pets(db, principal.account_id)


@router.get("/{pet_id}", response_model=s.PetOut, summary="Get a pet profile")
def get_pet(pet_id: uuid.UUID, principal: Principal = authenticated, db: Session = Depends(get_db)):
    return pet_service._readable_pet_or_404(db, pet_id, principal)


@router.patch("/{pet_id}", response_model=s.PetOut, summary="Edit pet profile (FR-02.1/02.6)")
def update_pet(
    pet_id: uuid.UUID,
    body: s.PetUpdateIn,
    principal: Principal = owner_only,
    db: Session = Depends(get_db),
):
    return pet_service.update_pet(db, pet_id, principal.account_id, body)


# ----- medical records (FR-02.2, append-only) -----
@router.post("/{pet_id}/medical-records", response_model=s.MedicalRecordOut,
             status_code=status.HTTP_201_CREATED, summary="Add a medical record (FR-02.2)")
def add_medical_record(
    pet_id: uuid.UUID,
    body: s.MedicalRecordCreateIn,
    principal: Principal = owner_only,
    db: Session = Depends(get_db),
):
    return pet_service.add_medical_record(db, pet_id, principal.account_id, body)


@router.get("/{pet_id}/medical-records", response_model=list[s.MedicalRecordOut],
            summary="List medical records (FR-02.2)")
def list_medical_records(
    pet_id: uuid.UUID, principal: Principal = authenticated, db: Session = Depends(get_db)
):
    return pet_service.list_medical_records(db, pet_id, principal)


# ----- vaccinations (FR-02.3 / 02.4) -----
@router.post("/{pet_id}/vaccinations", response_model=s.VaccinationRecordOut,
             status_code=status.HTTP_201_CREATED, summary="Pre-enter a vaccination (FR-02.3)")
def add_vaccination(
    pet_id: uuid.UUID,
    body: s.VaccinationCreateIn,
    principal: Principal = owner_only,
    db: Session = Depends(get_db),
):
    return pet_service.add_vaccination(db, pet_id, principal.account_id, body)


@router.get("/{pet_id}/vaccinations", response_model=list[s.VaccinationRecordOut],
            summary="List vaccinations")
def list_vaccinations(
    pet_id: uuid.UUID, principal: Principal = authenticated, db: Session = Depends(get_db)
):
    return pet_service.list_vaccinations(db, pet_id, principal)


@router.post("/{pet_id}/vaccinations/{vaccination_id}/proof",
             response_model=s.VaccineProofDocumentOut, status_code=status.HTTP_201_CREATED,
             summary="Upload vaccine proof document (FR-02.4)")
def upload_vaccine_proof(
    pet_id: uuid.UUID,
    vaccination_id: uuid.UUID,
    file: UploadFile = File(...),
    principal: Principal = owner_only,
    db: Session = Depends(get_db),
):
    return pet_service.upload_vaccine_proof(db, pet_id, vaccination_id, principal.account_id, file)


# ----- danger level (FR-02.7) -----
@router.post("/{pet_id}/danger-level", response_model=s.PetOut,
             summary="Mark danger level — Staff/Groomer: Low/Medium, Admin: High (FR-02.7)")
def mark_danger_level(
    pet_id: uuid.UUID,
    body: s.DangerLevelMarkIn,
    principal: Principal = staff_danger,
    db: Session = Depends(get_db),
):
    return pet_service.mark_danger_level(db, pet_id, principal, body)


@router.post("/{pet_id}/unblock", response_model=s.PetOut, summary="Unblock a pet — admin (FR-02.7)")
def unblock_pet(pet_id: uuid.UUID, principal: Principal = admin_only, db: Session = Depends(get_db)):
    return pet_service.unblock_pet(db, pet_id, principal.account_id)
