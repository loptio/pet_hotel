"""Booking router — gateway-exposed group "Booking" (BookingService).

Covers booking creation with danger gating (FR-03.1/02.8, seq1), availability
(FR-03.2/06.2), list & history (FR-03.4), deposit + final payment (FR-05.3),
and staff review of PendingReview bookings (seq5). Static paths are declared
before /{booking_id} so they route correctly.

RBAC per api-overview / seed grants: catalogue + availability for any
authenticated caller; create / deposit are Owner; final payment Owner or
FrontDesk (on-site card); pending-review + review are FrontDesk; reads are
owner-or-staff (enforced in the service).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.common.schemas import ErrorOut
from app.core.database import get_db
from app.core.security import Principal, get_current_principal, require_roles
from app.modules.booking import schemas as s
from app.modules.booking.service import booking_service

router = APIRouter(prefix="/bookings", tags=["Booking"], dependencies=[Depends(get_current_principal)])

owner_only = Depends(require_roles("Owner"))
frontdesk_only = Depends(require_roles("FrontDesk"))
review_readers = Depends(require_roles("FrontDesk", "Admin"))
pay_roles = Depends(require_roles("Owner", "FrontDesk"))
authenticated = Depends(get_current_principal)


# ----- static paths first -----
@router.get("/services", response_model=list[s.ServiceItemOut],
            summary="List bookable service items — Standard/Deluxe room, Basic/Full grooming (FR-03.1/03.7)")
def list_services(category: s.ServiceCategory | None = Query(default=None),
                  principal: Principal = authenticated, db: Session = Depends(get_db)):
    return booking_service.list_services(db, category)


@router.get("/availability", response_model=s.AvailabilityOut,
            summary="Check availability for a service + window (FR-03.2/06.2)")
def check_availability(
    service_item_id: uuid.UUID = Query(...),
    start_at: datetime = Query(...),
    end_at: datetime = Query(...),
    principal: Principal = authenticated,
    db: Session = Depends(get_db),
):
    return booking_service.check_availability(db, service_item_id, start_at, end_at)


@router.get("/pending-review", response_model=list[s.BookingOut],
            summary="List PendingReview bookings — staff (FR-02.8, seq5)")
def list_pending_review(principal: Principal = review_readers, db: Session = Depends(get_db)):
    return booking_service.list_pending_review(db)


@router.post("", response_model=s.BookingOut, status_code=status.HTTP_201_CREATED,
             responses={status.HTTP_409_CONFLICT: {"model": ErrorOut,
                        "description": "Rejected — pet danger level is High (FR-02.8)"}},
             summary="Create a lodging/grooming booking (FR-03.1, seq1)")
def create_booking(body: s.BookingCreateIn, principal: Principal = owner_only,
                   db: Session = Depends(get_db)):
    return booking_service.create_booking(db, principal.account_id, body)


@router.get("", response_model=list[s.BookingOut],
            summary="List my bookings — current + history (FR-03.4)")
def list_bookings(status_filter: s.BookingStatus | None = Query(default=None, alias="status"),
                  principal: Principal = authenticated, db: Session = Depends(get_db)):
    return booking_service.list_bookings(db, principal, status_filter)


# ----- parametric paths -----
@router.get("/{booking_id}", response_model=s.BookingDetailOut,
            summary="Get booking detail incl. items + pets (FR-03.4/04.4)")
def get_booking(booking_id: uuid.UUID, principal: Principal = authenticated,
                db: Session = Depends(get_db)):
    return booking_service.get_booking(db, booking_id, principal)


@router.post("/{booking_id}/deposit", response_model=s.BookingPaymentResultOut,
             summary="Pay deposit (30%) and confirm (FR-05.3, seq1)")
def pay_deposit(booking_id: uuid.UUID, body: s.DepositPaymentIn, principal: Principal = owner_only,
                db: Session = Depends(get_db)):
    return booking_service.pay_deposit(db, booking_id, principal.account_id, body)


@router.post("/{booking_id}/final-payment", response_model=s.BookingPaymentResultOut,
             summary="Settle the final balance (FR-05.3)")
def pay_final(booking_id: uuid.UUID, body: s.FinalPaymentIn, principal: Principal = pay_roles,
              db: Session = Depends(get_db)):
    return booking_service.pay_final(db, booking_id, principal, body)


@router.post("/{booking_id}/review", response_model=s.BookingOut,
             summary="Approve/Reject a PendingReview booking — staff (FR-02.8, seq5)")
def review_booking(booking_id: uuid.UUID, body: s.ReviewIn, principal: Principal = frontdesk_only,
                   db: Session = Depends(get_db)):
    return booking_service.review_booking(db, booking_id, principal.account_id, body)
