"""Cancellation router — gateway-exposed group "Cancellation"
(CancellationService). Covers FR-03.3 / FR-05.4 (seq4).

RBAC: Owner cancels their own booking (booking.cancel); ownership is enforced in
the service.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import Principal, get_current_principal, require_roles
from app.modules.cancellation import schemas as s
from app.modules.cancellation.service import cancellation_service

router = APIRouter(prefix="/cancellation", tags=["Cancellation"],
                   dependencies=[Depends(get_current_principal)])

owner_only = Depends(require_roles("Owner"))


@router.post("/bookings/{booking_id}", response_model=s.CancellationResultOut,
             summary="Cancel a booking + apply 24h refund rule (FR-03.3/05.4, seq4)")
def cancel_booking(booking_id: uuid.UUID, body: s.CancelBookingIn,
                   principal: Principal = owner_only, db: Session = Depends(get_db)):
    return cancellation_service.cancel_booking(db, principal.account_id, booking_id, body)
