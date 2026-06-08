"""Payment package (class diagram §4) — internal module (no external router).

PaymentMethod has exactly Online / CardOnSite — NO cash (red line). NFR-03:
card data is never stored; only transaction metadata + provider reference.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin, UUIDPrimaryKey, pg_enum


class PaymentType(str, enum.Enum):
    DEPOSIT = "Deposit"
    FINAL_PAY = "FinalPay"
    REFUND = "Refund"


class PaymentMethod(str, enum.Enum):
    ONLINE = "Online"
    CARD_ON_SITE = "CardOnSite"


class PaymentStatus(str, enum.Enum):
    PENDING = "Pending"
    AUTHORIZED = "Authorized"
    FAILED = "Failed"
    REFUNDED = "Refunded"


class PaymentProvider(str, enum.Enum):
    ECPAY = "ECPay"


class PaymentTransaction(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "payment_transactions"

    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    type: Mapped[PaymentType] = mapped_column(pg_enum(PaymentType, "payment_type"), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        pg_enum(PaymentMethod, "payment_method"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="TWD", nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        pg_enum(PaymentStatus, "payment_status"), default=PaymentStatus.PENDING, nullable=False
    )
    provider: Mapped[PaymentProvider] = mapped_column(
        pg_enum(PaymentProvider, "payment_provider"), default=PaymentProvider.ECPAY, nullable=False
    )
    provider_txn_id: Mapped[str | None] = mapped_column(String(120))
