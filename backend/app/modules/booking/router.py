"""Booking router — gateway-exposed group "Booking" (BookingService).

Covers booking creation with danger gating (FR-03.1/02.8, seq1), availability
(FR-03.2/06.2), list & history (FR-03.4), deposit + final payment (FR-05.3),
and staff review of PendingReview bookings (seq5). Static paths are declared
before /{booking_id} so they route correctly.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status

from app.common.responses import not_implemented
from app.common.schemas import ErrorOut
from app.core.security import get_current_principal
from app.modules.booking import schemas as s

router = APIRouter(prefix="/bookings", tags=["Booking"], dependencies=[Depends(get_current_principal)])


# ----- static paths first -----
@router.get("/services", response_model=list[s.ServiceItemOut],
            summary="List bookable service items — Standard/Deluxe room, Basic/Full grooming (FR-03.1/03.7)")
def list_services(category: s.ServiceCategory | None = Query(default=None)):
    raise not_implemented("FR-03.1/03.7 list service catalogue")


@router.get("/availability", response_model=s.AvailabilityOut,
            summary="Check availability for a service + window (FR-03.2/06.2)")
def check_availability(
    service_item_id: uuid.UUID = Query(...),
    start_at: datetime = Query(...),
    end_at: datetime = Query(...),
):
    raise not_implemented("FR-03.2/06.2 availability")


@router.get("/pending-review", response_model=list[s.BookingOut],
            summary="List PendingReview bookings — staff (FR-02.8, seq5)")
def list_pending_review():
    raise not_implemented("FR-02.8 pending-review list")


@router.post("", response_model=s.BookingOut, status_code=status.HTTP_201_CREATED,
             responses={status.HTTP_409_CONFLICT: {"model": ErrorOut,
                        "description": "Rejected — pet danger level is High (FR-02.8)"}},
             summary="Create a lodging/grooming booking (FR-03.1, seq1)")
def create_booking(body: s.BookingCreateIn):
    raise not_implemented("FR-03.1 create booking")


@router.get("", response_model=list[s.BookingOut],
            summary="List my bookings — current + history (FR-03.4)")
def list_bookings(status_filter: s.BookingStatus | None = Query(default=None, alias="status")):
    raise not_implemented("FR-03.4 list bookings")


# ----- parametric paths -----
@router.get("/{booking_id}", response_model=s.BookingDetailOut,
            summary="Get booking detail incl. items + pets (FR-03.4/04.4)")
def get_booking(booking_id: uuid.UUID):
    raise not_implemented("FR-03.4 get booking")


@router.post("/{booking_id}/deposit", response_model=s.BookingPaymentResultOut,
             summary="Pay deposit (30%) and confirm (FR-05.3, seq1)")
def pay_deposit(booking_id: uuid.UUID, body: s.DepositPaymentIn):
    raise not_implemented("FR-05.3 deposit")


@router.post("/{booking_id}/final-payment", response_model=s.BookingPaymentResultOut,
             summary="Settle the final balance (FR-05.3)")
def pay_final(booking_id: uuid.UUID, body: s.FinalPaymentIn):
    raise not_implemented("FR-05.3 final payment")


@router.post("/{booking_id}/review", response_model=s.BookingOut,
             summary="Approve/Reject a PendingReview booking — staff (FR-02.8, seq5)")
def review_booking(booking_id: uuid.UUID, body: s.ReviewIn):
    raise not_implemented("FR-02.8 review booking")
