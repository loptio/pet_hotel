"""ORM → contract-schema mappers for the money-bearing booking/payment shapes.

`Money` (SDD §3.5) is a value object {amount, currency}, but the ORM stores the
amount and currency as two plain columns, so Pydantic's ``from_attributes`` can't
build it automatically. These helpers assemble the ``*Out`` schemas explicitly.
Kept out of schemas.py so the generated OpenAPI is untouched (the frozen
contract); kept out of the service so the mapping is reused/tested in one place.
"""
from __future__ import annotations

from decimal import Decimal

from app.common.schemas import Money
from app.modules.booking import schemas as s
from app.modules.booking.models import Booking, BookingItem, ServiceItem
from app.modules.payment.models import PaymentTransaction


def money(amount: Decimal, currency: str = "TWD") -> Money:
    return Money(amount=amount, currency=currency or "TWD")


def service_item_out(si: ServiceItem) -> s.ServiceItemOut:
    return s.ServiceItemOut(
        id=si.id,
        name=si.name,
        category=si.category,
        base_price=money(si.base_price, si.currency),
        duration_minutes=si.duration_minutes,
        room_type=si.room_type,
        grooming_type=si.grooming_type,
        is_active=si.is_active,
    )


def booking_item_out(bi: BookingItem) -> s.BookingItemOut:
    return s.BookingItemOut(
        id=bi.id,
        service_item_id=bi.service_item_id,
        booked_pet_id=bi.booked_pet_id,
        unit_price=money(bi.unit_price, bi.currency),
        quantity=bi.quantity,
    )


def booking_out(b: Booking) -> s.BookingOut:
    return s.BookingOut(
        id=b.id,
        owner_id=b.owner_id,
        status=b.status,
        start_at=b.start_at,
        end_at=b.end_at,
        total_amount=money(b.total_amount, b.currency),
        deposit_amount=money(b.deposit_amount, b.currency),
        cancelled_at=b.cancelled_at,
        cancel_reason=b.cancel_reason,
        created_at=b.created_at,
    )


def booking_detail_out(b: Booking) -> s.BookingDetailOut:
    return s.BookingDetailOut(
        **booking_out(b).model_dump(),
        items=[booking_item_out(bi) for bi in b.items],
        booked_pets=[
            s.BookedPetOut(id=bp.id, pet_id=bp.pet_id, kennel_id=bp.kennel_id)
            for bp in b.booked_pets
        ],
    )


def payment_result_out(txn: PaymentTransaction) -> s.PaymentResultOut:
    return s.PaymentResultOut(
        transaction_id=txn.id,
        type=txn.type,
        method=txn.method,
        amount=money(txn.amount, txn.currency),
        status=txn.status,
    )
