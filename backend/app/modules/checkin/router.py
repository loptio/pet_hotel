"""Check-in router — gateway-exposed group "CheckIn" (CheckInService).

Covers FR-04.1 check-in (seq2), FR-02.5 counter vaccine entry, FR-06.1 expiry
gating, check-out, and front-desk kennel management (FR-03.6/06.4). Kennel
endpoints are placed here because kennel management is a front-desk capability
(KennelService is internal in the SDD component diagram).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.common.responses import not_implemented
from app.core.security import get_current_principal
from app.modules.checkin import schemas as s
from app.modules.grooming.schemas import EmergencyEventOut
from app.modules.pet.schemas import VaccinationRecordOut

router = APIRouter(prefix="/checkin", tags=["CheckIn"], dependencies=[Depends(get_current_principal)])


# ----- kennel management (static paths first) FR-03.6 / FR-06.4 -----
@router.get("/kennels", response_model=list[s.KennelOut],
            summary="List kennels + occupancy (FR-03.6)")
def list_kennels():
    raise not_implemented("FR-03.6 list kennels")


@router.patch("/kennels/{kennel_id}", response_model=s.KennelOut,
              summary="Update kennel status — staff (FR-06.4)")
def update_kennel(kennel_id: uuid.UUID, body: s.KennelUpdateIn):
    raise not_implemented("FR-06.4 update kennel")


@router.post("/kennels/{kennel_id}/available", response_model=s.KennelOut,
             summary="Mark a cleaned kennel Available — manual (FR-06.4)")
def mark_kennel_available(kennel_id: uuid.UUID):
    raise not_implemented("FR-06.4 mark kennel available")


# ----- check-in flow -----
@router.post("", response_model=s.CheckInResultOut,
             summary="Perform check-in: verify booking + chip + vaccine, assign kennel (FR-04.1, seq2)")
def check_in(body: s.CheckInRequestIn):
    raise not_implemented("FR-04.1 check-in")


@router.get("/{booking_id}/verify", response_model=s.BookingVerifyOut,
            summary="Verify booking status before check-in (FR-04.1)")
def verify_booking(booking_id: uuid.UUID):
    raise not_implemented("FR-04.1 verify booking")


@router.post("/{booking_id}/vaccine", response_model=VaccinationRecordOut,
             summary="Record vaccine at counter + auto-verify expiry (FR-02.5/06.1, seq2)")
def record_vaccine(booking_id: uuid.UUID, body: s.VaccineRecordAtCounterIn):
    raise not_implemented("FR-02.5 record vaccine")


@router.post("/{booking_id}/checkout", response_model=s.CheckInResultOut,
             summary="Check out: pet leaves → kennel Cleaning (FR-06.4)")
def check_out(booking_id: uuid.UUID):
    raise not_implemented("FR-06.4 check-out")


@router.post("/{booking_id}/emergency", response_model=EmergencyEventOut,
             status_code=status.HTTP_201_CREATED,
             summary="Front-desk trigger emergency for a booked pet — Booking-layer (FR-06.3, SDD §8)")
def trigger_emergency(booking_id: uuid.UUID, body: s.EmergencyAtCounterIn):
    raise not_implemented("FR-06.3 front-desk emergency")
