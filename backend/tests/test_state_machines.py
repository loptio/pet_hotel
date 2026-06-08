"""Unit tests for the three state machines (SDD §4.4) — legal advances pass,
illegal ones raise 409. Pure logic, no DB."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.modules.booking.models import BookingStatus, KennelStatus
from app.modules.booking.state import assert_booking_transition, assert_kennel_transition
from app.modules.grooming.models import WorkStatus
from app.modules.grooming.service import assert_work_transition

B = BookingStatus
K = KennelStatus
W = WorkStatus


# ---------------- Booking (9 states) ----------------
@pytest.mark.parametrize("current,target", [
    (B.PENDING_DEPOSIT, B.CONFIRMED),
    (B.PENDING_DEPOSIT, B.CANCELLED),
    (B.PENDING_REVIEW, B.PENDING_DEPOSIT),
    (B.PENDING_REVIEW, B.CANCELLED),
    (B.CONFIRMED, B.CHECKED_IN),
    (B.CONFIRMED, B.CANCELLED),
    (B.CONFIRMED, B.NO_SHOW),
    (B.CHECKED_IN, B.IN_PROGRESS),
    (B.CHECKED_IN, B.COMPLETED),
    (B.CHECKED_IN, B.ABORTED),
    (B.IN_PROGRESS, B.COMPLETED),
    (B.IN_PROGRESS, B.ABORTED),
])
def test_booking_legal_transitions(current, target):
    assert_booking_transition(current, target)  # no raise


@pytest.mark.parametrize("current,target", [
    (B.PENDING_DEPOSIT, B.CHECKED_IN),       # must confirm first
    (B.PENDING_DEPOSIT, B.IN_PROGRESS),
    (B.PENDING_REVIEW, B.CONFIRMED),         # review only re-opens deposit
    (B.CONFIRMED, B.COMPLETED),              # cannot skip check-in
    (B.CONFIRMED, B.IN_PROGRESS),
    (B.CHECKED_IN, B.CONFIRMED),             # no going back
    (B.COMPLETED, B.IN_PROGRESS),            # terminal
    (B.CANCELLED, B.CONFIRMED),              # terminal
    (B.NO_SHOW, B.CONFIRMED),                # terminal
    (B.ABORTED, B.COMPLETED),                # terminal
])
def test_booking_illegal_transitions(current, target):
    with pytest.raises(HTTPException) as ei:
        assert_booking_transition(current, target)
    assert ei.value.status_code == 409


# ---------------- WorkOrder (7 states) ----------------
@pytest.mark.parametrize("current,target", [
    (W.PENDING, W.PRE_CHECK),
    (W.PRE_CHECK, W.BATHING),
    (W.BATHING, W.DRYING),
    (W.DRYING, W.GROOMING),
    (W.GROOMING, W.COMPLETED),
    (W.PENDING, W.ABORTED),     # any stage → Aborted (FR-06.3)
    (W.PRE_CHECK, W.ABORTED),
    (W.BATHING, W.ABORTED),
    (W.DRYING, W.ABORTED),
    (W.GROOMING, W.ABORTED),
])
def test_workorder_legal_transitions(current, target):
    assert_work_transition(current, target)


@pytest.mark.parametrize("current,target", [
    (W.PENDING, W.BATHING),       # cannot skip PreCheck
    (W.PRE_CHECK, W.DRYING),      # cannot skip Bathing
    (W.BATHING, W.GROOMING),      # cannot skip Drying
    (W.DRYING, W.COMPLETED),      # cannot skip Grooming
    (W.PRE_CHECK, W.COMPLETED),
    (W.COMPLETED, W.GROOMING),    # terminal
    (W.ABORTED, W.PRE_CHECK),     # terminal
])
def test_workorder_illegal_transitions(current, target):
    with pytest.raises(HTTPException) as ei:
        assert_work_transition(current, target)
    assert ei.value.status_code == 409


# ---------------- Kennel (4 states, cyclic) ----------------
@pytest.mark.parametrize("current,target", [
    (K.AVAILABLE, K.RESERVED),
    (K.RESERVED, K.OCCUPIED),
    (K.RESERVED, K.AVAILABLE),    # release on cancel / no-show
    (K.OCCUPIED, K.CLEANING),
    (K.CLEANING, K.AVAILABLE),    # front-desk manual (FR-06.4)
])
def test_kennel_legal_transitions(current, target):
    assert_kennel_transition(current, target)


@pytest.mark.parametrize("current,target", [
    (K.AVAILABLE, K.OCCUPIED),    # must reserve first
    (K.AVAILABLE, K.CLEANING),
    (K.OCCUPIED, K.AVAILABLE),    # must clean first
    (K.OCCUPIED, K.RESERVED),
    (K.CLEANING, K.OCCUPIED),
])
def test_kennel_illegal_transitions(current, target):
    with pytest.raises(HTTPException) as ei:
        assert_kennel_transition(current, target)
    assert ei.value.status_code == 409


def test_kennel_self_transition_is_noop():
    assert_kennel_transition(K.AVAILABLE, K.AVAILABLE)  # idempotent, no raise
