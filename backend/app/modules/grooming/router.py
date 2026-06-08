"""Grooming router — gateway-exposed group "Grooming" (GroomingService).

Covers FR-04.2/04.4/04.5 + FR-06.3 (seq3): work-order lifecycle, 4-stage
advance, photo upload, completion, and emergency trigger.

RBAC: lifecycle actions (start/stage/complete/photo upload/emergency) are
Groomer (grooming.execute / emergency.trigger); reads of a work order + its
photos are staff-or-owner (FR-04.4), enforced in the service; the queue listing
is staff.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import Principal, get_current_principal, require_roles
from app.modules.grooming import schemas as s
from app.modules.grooming.service import grooming_service

router = APIRouter(prefix="/grooming", tags=["Grooming"], dependencies=[Depends(get_current_principal)])

groomer_only = Depends(require_roles("Groomer"))
staff_only = Depends(require_roles("Groomer", "FrontDesk", "Admin"))
authenticated = Depends(get_current_principal)


@router.get("/work-orders", response_model=list[s.WorkOrderOut],
            summary="List work orders (groomer queue / by booking)")
def list_work_orders(principal: Principal = staff_only, db: Session = Depends(get_db)):
    return grooming_service.list_work_orders(db)


@router.get("/work-orders/{work_order_id}", response_model=s.WorkOrderDetailOut,
            summary="Get work-order detail incl. photos (FR-04.4)")
def get_work_order(work_order_id: uuid.UUID, principal: Principal = authenticated,
                   db: Session = Depends(get_db)):
    return grooming_service.get_work_order(db, work_order_id, principal)


@router.post("/work-orders/{work_order_id}/start", response_model=s.WorkOrderOut,
             summary="Start a work order: Pending → PreCheck (seq3)")
def start_work_order(work_order_id: uuid.UUID, principal: Principal = groomer_only,
                     db: Session = Depends(get_db)):
    return grooming_service.start_work_order(db, work_order_id, principal.account_id)


@router.post("/work-orders/{work_order_id}/stage", response_model=s.WorkOrderOut,
             summary="Advance stage: PreCheck/Bathing/Drying/Grooming (FR-04.5, seq3)")
def update_stage(work_order_id: uuid.UUID, body: s.StageUpdateIn,
                 principal: Principal = groomer_only, db: Session = Depends(get_db)):
    return grooming_service.update_stage(db, work_order_id, principal.account_id, body)


@router.post("/work-orders/{work_order_id}/photos", response_model=s.WorkPhotoOut,
             status_code=status.HTTP_201_CREATED, summary="Upload a work photo (FR-04.2)")
def upload_photo(work_order_id: uuid.UUID, file: UploadFile = File(...),
                 principal: Principal = groomer_only, db: Session = Depends(get_db)):
    return grooming_service.upload_photo(db, work_order_id, file)


@router.get("/work-orders/{work_order_id}/photos", response_model=list[s.WorkPhotoOut],
            summary="List work photos (FR-04.4)")
def list_photos(work_order_id: uuid.UUID, principal: Principal = authenticated,
                db: Session = Depends(get_db)):
    return grooming_service.list_photos(db, work_order_id, principal)


@router.post("/work-orders/{work_order_id}/complete", response_model=s.WorkOrderOut,
             summary="Complete a work order: Grooming → Completed (seq3)")
def complete(work_order_id: uuid.UUID, principal: Principal = groomer_only,
             db: Session = Depends(get_db)):
    return grooming_service.complete(db, work_order_id, principal.account_id)


@router.post("/work-orders/{work_order_id}/emergency", response_model=s.EmergencyEventOut,
             status_code=status.HTTP_201_CREATED,
             summary="Trigger emergency: any stage → Aborted (FR-06.3, seq3)")
def trigger_emergency(work_order_id: uuid.UUID, body: s.EmergencyTriggerIn,
                      principal: Principal = groomer_only, db: Session = Depends(get_db)):
    return grooming_service.trigger_emergency(db, work_order_id, principal.account_id, body)
