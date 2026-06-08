"""Cancellation router — gateway-exposed group "Cancellation"
(CancellationService). Covers FR-03.3 / FR-05.4 (seq4)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.common.responses import not_implemented
from app.core.security import get_current_principal
from app.modules.cancellation import schemas as s

router = APIRouter(prefix="/cancellation", tags=["Cancellation"],
                   dependencies=[Depends(get_current_principal)])


@router.post("/bookings/{booking_id}", response_model=s.CancellationResultOut,
             summary="Cancel a booking + apply 24h refund rule (FR-03.3/05.4, seq4)")
def cancel_booking(booking_id: uuid.UUID, body: s.CancelBookingIn):
    raise not_implemented("FR-03.3/05.4 cancel booking")
