"""Shared Pydantic v2 building blocks for the API contract.

- ``CamelModel``: all request/response schemas serialise as camelCase (matches
  the class diagram's attribute names + the React/TS frontend), while Python
  code uses snake_case. ``populate_by_name`` lets callers send either.
- ``Money``: SDD §3.5 value object — decimal amount + ISO currency (TWD).
"""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class Money(CamelModel):
    """SDD §3.5: monetary value as decimal + currency. Single-currency system
    (ECPay / Taiwan) so currency defaults to TWD."""

    amount: Decimal = Field(..., ge=0, examples=[Decimal("1500.00")])
    currency: str = Field(default="TWD", min_length=3, max_length=3, examples=["TWD"])


class MessageOut(CamelModel):
    """Generic acknowledgement payload."""

    message: str = Field(..., examples=["ok"])


class ErrorOut(CamelModel):
    """Shape of error responses (e.g. danger-High rejection, unavailable slot)."""

    detail: str = Field(..., examples=["Booking rejected: pet danger level is High"])
    code: str | None = Field(default=None, examples=["DANGER_LEVEL_HIGH"])


class Page(CamelModel):
    """Lightweight pagination envelope used by list endpoints."""

    total: int = Field(..., examples=[0])
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=200)
