"""Cancellation schemas (Pydantic v2, camelCase)."""
from __future__ import annotations

from pydantic import Field

from app.common.schemas import CamelModel, Money
from app.modules.booking.schemas import BookingOut
from app.modules.payment.models import PaymentStatus


class CancelBookingIn(CamelModel):
    """NFR-05 — every cancellation records a reason (retained ≥180 days)."""

    reason: str = Field(..., examples=["臨時有事無法前往"])


class RefundOut(CamelModel):
    """FR-05.4 — >24h before start: full deposit refund; ≤24h or no-show: none."""

    eligible: bool
    status: PaymentStatus | None = Field(default=None, examples=[PaymentStatus.REFUNDED])
    amount: Money | None = None
    reason: str = Field(..., examples=["取消時間距開始 > 24 小時，全額退還訂金"])


class CancellationResultOut(CamelModel):
    booking: BookingOut
    refund: RefundOut
