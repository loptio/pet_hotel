"""State machines for Booking and Kennel (SDD §4.4 — authoritative for
implementation). Illegal transitions are rejected with HTTP 409.

These tables live in the booking module because both the Booking aggregate and
the Kennel entity belong to the "Booking & Service Execution" package; the
check-in / grooming / cancellation services import the asserts so every service
drives the same machine.

Booking (9 states) and Kennel (4 states, cyclic) per SDD §4.4 / api-overview.
The WorkOrder (7 states) machine lives with the grooming service.

Note vs the early hand-drawn state PUMLs (which show a simplified
Pending→Confirmed→CheckedIn→Completed): the authoritative machines are the
expanded 9/7/4-state ones in SDD §4.4 + the class-diagram enums, which the DB
enums and the frozen contract already encode.
"""
from __future__ import annotations

from fastapi import HTTPException, status

from app.modules.booking.models import BookingStatus, KennelStatus

# Booking: current → allowed targets. Terminal states (Cancelled / Completed /
# NoShow / Aborted) have no outgoing transitions.
#
# CheckedIn → Completed (direct) covers a lodging stay closed at check-out, which
# never enters the grooming-only InProgress sub-state; CheckedIn → Aborted covers
# a front-desk emergency for a lodging pet (SDD §8 moved EmergencyEvent to the
# Booking layer). Both extend the grooming-centric wording of SDD §4.4 to the
# lodging path and are reported as interpretations.
BOOKING_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    BookingStatus.PENDING_DEPOSIT: {BookingStatus.CONFIRMED, BookingStatus.CANCELLED},
    BookingStatus.PENDING_REVIEW: {BookingStatus.PENDING_DEPOSIT, BookingStatus.CANCELLED},
    BookingStatus.CONFIRMED: {
        BookingStatus.CHECKED_IN,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
    },
    BookingStatus.CHECKED_IN: {
        BookingStatus.IN_PROGRESS,
        BookingStatus.COMPLETED,
        BookingStatus.ABORTED,
    },
    BookingStatus.IN_PROGRESS: {BookingStatus.COMPLETED, BookingStatus.ABORTED},
    BookingStatus.CANCELLED: set(),
    BookingStatus.COMPLETED: set(),
    BookingStatus.NO_SHOW: set(),
    BookingStatus.ABORTED: set(),
}

# Kennel: cyclic, no terminal. Reserved → Available releases a hold on
# cancel / no-show (SDD §4.4). Cleaning → Available is the front-desk manual step
# (FR-06.4) and also has its own dedicated endpoint.
KENNEL_TRANSITIONS: dict[KennelStatus, set[KennelStatus]] = {
    KennelStatus.AVAILABLE: {KennelStatus.RESERVED},
    KennelStatus.RESERVED: {KennelStatus.OCCUPIED, KennelStatus.AVAILABLE},
    KennelStatus.OCCUPIED: {KennelStatus.CLEANING},
    KennelStatus.CLEANING: {KennelStatus.AVAILABLE},
}


def assert_booking_transition(current: BookingStatus, target: BookingStatus) -> None:
    if target not in BOOKING_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Illegal booking transition: {current.value} → {target.value}",
        )


def assert_kennel_transition(current: KennelStatus, target: KennelStatus) -> None:
    if current == target:
        return
    if target not in KENNEL_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Illegal kennel transition: {current.value} → {target.value}",
        )
