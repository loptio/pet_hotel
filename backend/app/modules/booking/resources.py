"""Resource (kennel) orchestration for the booking lifecycle.

Centralises the Kennel state machine moves and the over-booking guard (FR-03.2)
so booking / check-in / grooming / cancellation all drive beds the same way.
Lives in the booking domain because Kennel and Booking share its package.

Over-booking guard (FR-03.2, demo): a kennel is grabbed with
``SELECT ... FOR UPDATE SKIP LOCKED`` — Postgres row-locks the chosen Available
bed so a concurrent booking transaction cannot pick the same one (it skips the
locked row and takes the next, or finds none → 409). The Redis distributed lock
named in the SDD is the production equivalent; the interface is kept below
(``kennel_allocation_lock``) but is a no-op for the single-node demo.
"""
from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.booking.models import (
    BookedPet,
    Booking,
    BookingItem,
    BookingStatus,
    Kennel,
    KennelStatus,
    ResourceAllocation,
    ServiceCategory,
    ServiceItem,
)
from app.modules.booking.state import assert_booking_transition, assert_kennel_transition
from app.modules.grooming.models import WorkOrder, WorkStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


@contextmanager
def kennel_allocation_lock():
    """Interface placeholder for the SDD's Redis distributed lock. The real
    serialization in the demo is the DB row lock in ``_lock_available_kennel``;
    this no-op keeps the seam so a Redis lock can be dropped in for multi-node."""
    yield


def _audit_kennel(db: Session, kennel: Kennel, operator_id: uuid.UUID | None) -> None:
    audit_service.audit(
        db,
        action_type=AuditActionType.KENNEL_STATUS_CHANGED,
        entity_type="Kennel",
        entity_id=kennel.id,
        operator_id=operator_id,
    )


def _set_kennel(db: Session, kennel: Kennel, target: KennelStatus, operator_id) -> None:
    assert_kennel_transition(kennel.status, target)
    if kennel.status != target:
        kennel.status = target
        _audit_kennel(db, kennel, operator_id)


def _lock_available_kennel(db: Session, room_type) -> Kennel | None:
    """Pick + row-lock one Available kennel of the room type (FR-03.2)."""
    return (
        db.execute(
            select(Kennel)
            .where(Kennel.type == room_type, Kennel.status == KennelStatus.AVAILABLE)
            .order_by(Kennel.kennel_number)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        .scalars()
        .first()
    )


def allocate_kennels(db: Session, booking: Booking, operator_id: uuid.UUID | None = None) -> None:
    """Lock + Reserve a matching kennel for every lodging item and pin it to the
    item's booked pet (FR-03.2 lock-at-submission, FR-03.6 auto-assign by room
    type). 409 if no bed is available — never over-book."""
    with kennel_allocation_lock():
        for item in booking.items:
            si = db.get(ServiceItem, item.service_item_id)
            if si is None or si.category != ServiceCategory.LODGING:
                continue
            bp = db.get(BookedPet, item.booked_pet_id)
            if bp is None or bp.kennel_id is not None:
                continue
            kennel = _lock_available_kennel(db, si.room_type)
            if kennel is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"No available {si.room_type.value} kennel for the requested window",
                )
            _set_kennel(db, kennel, KennelStatus.RESERVED, operator_id)
            bp.kennel_id = kennel.id
            db.add(
                ResourceAllocation(
                    booking_id=booking.id,
                    resource_type="kennel",
                    resource_id=str(kennel.id),
                    locked_at=_now(),
                )
            )
    db.flush()


def occupy_kennels(db: Session, booking: Booking, operator_id: uuid.UUID | None = None) -> list[str]:
    """Reserved → Occupied at check-in (FR-06.4). Returns the kennel numbers."""
    numbers: list[str] = []
    for bp in booking.booked_pets:
        if bp.kennel_id is None:
            continue
        kennel = db.get(Kennel, bp.kennel_id)
        if kennel is None:
            continue
        _set_kennel(db, kennel, KennelStatus.OCCUPIED, operator_id)
        numbers.append(kennel.kennel_number)
    db.flush()
    return numbers


def checkout_kennels(db: Session, booking: Booking, operator_id: uuid.UUID | None = None) -> list[str]:
    """Occupied → Cleaning at check-out (FR-06.4). Returns the kennel numbers."""
    numbers: list[str] = []
    for bp in booking.booked_pets:
        if bp.kennel_id is None:
            continue
        kennel = db.get(Kennel, bp.kennel_id)
        if kennel is None or kennel.status != KennelStatus.OCCUPIED:
            continue
        _set_kennel(db, kennel, KennelStatus.CLEANING, operator_id)
        numbers.append(kennel.kennel_number)
    db.flush()
    return numbers


def release_booking_resources(
    db: Session, booking: Booking, operator_id: uuid.UUID | None = None
) -> None:
    """Free a booking's beds on cancel / no-show / abort: Reserved → Available
    (FR-05.4 / FR-03.5) or Occupied → Cleaning (emergency mid-stay)."""
    for bp in booking.booked_pets:
        if bp.kennel_id is None:
            continue
        kennel = db.get(Kennel, bp.kennel_id)
        if kennel is None:
            continue
        if kennel.status == KennelStatus.RESERVED:
            _set_kennel(db, kennel, KennelStatus.AVAILABLE, operator_id)
        elif kennel.status == KennelStatus.OCCUPIED:
            _set_kennel(db, kennel, KennelStatus.CLEANING, operator_id)
    for ra in booking.resource_allocations:
        if ra.released_at is None:
            ra.released_at = _now()
    db.flush()


def maybe_complete_booking(
    db: Session, booking: Booking, operator_id: uuid.UUID | None = None
) -> None:
    """Complete a booking once nothing is still in flight: no active work order
    and no bed still Occupied. Covers grooming (last work order done) and lodging
    (checked out). No-op if the booking isn't in an in-house state."""
    if booking.status not in (BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS):
        return
    active_work_orders = db.execute(
        select(func.count())
        .select_from(WorkOrder)
        .join(BookingItem, WorkOrder.booking_item_id == BookingItem.id)
        .where(
            BookingItem.booking_id == booking.id,
            WorkOrder.status.not_in([WorkStatus.COMPLETED, WorkStatus.ABORTED]),
        )
    ).scalar_one()
    if active_work_orders:
        return
    for bp in booking.booked_pets:
        if bp.kennel_id is None:
            continue
        kennel = db.get(Kennel, bp.kennel_id)
        if kennel is not None and kennel.status == KennelStatus.OCCUPIED:
            return
    assert_booking_transition(booking.status, BookingStatus.COMPLETED)
    booking.status = BookingStatus.COMPLETED
    db.flush()
