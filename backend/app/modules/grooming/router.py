"""Grooming router — gateway-exposed group "Grooming" (GroomingService).

Covers FR-04.2/04.4/04.5 + FR-06.3 (seq3): work-order lifecycle, 4-stage
advance, photo upload, completion, and emergency trigger.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.common.responses import not_implemented
from app.core.security import get_current_principal
from app.modules.grooming import schemas as s

router = APIRouter(prefix="/grooming", tags=["Grooming"], dependencies=[Depends(get_current_principal)])


@router.get("/work-orders", response_model=list[s.WorkOrderOut],
            summary="List work orders (groomer queue / by booking)")
def list_work_orders():
    raise not_implemented("list work orders")


@router.get("/work-orders/{work_order_id}", response_model=s.WorkOrderDetailOut,
            summary="Get work-order detail incl. photos (FR-04.4)")
def get_work_order(work_order_id: uuid.UUID):
    raise not_implemented("FR-04.4 work order detail")


@router.post("/work-orders/{work_order_id}/start", response_model=s.WorkOrderOut,
             summary="Start a work order: Pending → PreCheck (seq3)")
def start_work_order(work_order_id: uuid.UUID):
    raise not_implemented("start work order")


@router.post("/work-orders/{work_order_id}/stage", response_model=s.WorkOrderOut,
             summary="Advance stage: PreCheck/Bathing/Drying/Grooming (FR-04.5, seq3)")
def update_stage(work_order_id: uuid.UUID, body: s.StageUpdateIn):
    raise not_implemented("FR-04.5 update stage")


@router.post("/work-orders/{work_order_id}/photos", response_model=s.WorkPhotoOut,
             status_code=status.HTTP_201_CREATED, summary="Upload a work photo (FR-04.2)")
def upload_photo(work_order_id: uuid.UUID, file: UploadFile = File(...)):
    raise not_implemented("FR-04.2 upload photo")


@router.get("/work-orders/{work_order_id}/photos", response_model=list[s.WorkPhotoOut],
            summary="List work photos (FR-04.4)")
def list_photos(work_order_id: uuid.UUID):
    raise not_implemented("FR-04.4 list photos")


@router.post("/work-orders/{work_order_id}/complete", response_model=s.WorkOrderOut,
             summary="Complete a work order: Grooming → Completed (seq3)")
def complete(work_order_id: uuid.UUID):
    raise not_implemented("complete work order")


@router.post("/work-orders/{work_order_id}/emergency", response_model=s.EmergencyEventOut,
             status_code=status.HTTP_201_CREATED,
             summary="Trigger emergency: any stage → Aborted (FR-06.3, seq3)")
def trigger_emergency(work_order_id: uuid.UUID, body: s.EmergencyTriggerIn):
    raise not_implemented("FR-06.3 trigger emergency")
