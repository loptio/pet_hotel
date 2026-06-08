"""Booking business rules — danger gating (FR-02.8), deposit = 30% (FR-05.3),
availability (FR-03.2/06.2), over-booking guard (FR-03.2), staff review (seq5)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal


def _window(days_ahead=3, length_hours=2):
    start = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).replace(microsecond=0)
    return start.isoformat(), (start + timedelta(hours=length_hours)).isoformat()


def _create(client, headers, service_id, pet_id, qty=1, days_ahead=3):
    start, end = _window(days_ahead)
    return client.post("/api/v1/bookings", headers=headers, json={
        "startAt": start, "endAt": end,
        "items": [{"serviceItemId": str(service_id), "petId": str(pet_id), "quantity": qty}],
    })


# ---------------- danger gating (FR-02.8) ----------------
def test_none_danger_creates_pending_deposit(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="None")
    r = _create(client, auth_headers(owner), svc.id, pet.id)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "PendingDeposit"


def test_low_danger_proceeds(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="Low")
    r = _create(client, auth_headers(owner), svc.id, pet.id)
    assert r.status_code == 201
    assert r.json()["status"] == "PendingDeposit"  # Low proceeds; warning is shown at check-in


def test_medium_danger_goes_pending_review(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="Medium")
    r = _create(client, auth_headers(owner), svc.id, pet.id)
    assert r.status_code == 201
    assert r.json()["status"] == "PendingReview"


def test_high_danger_blocked_is_409(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="High", blocked=True)
    r = _create(client, auth_headers(owner), svc.id, pet.id)
    assert r.status_code == 409
    assert "High" in r.json()["detail"]


def test_blocked_pet_rejected_even_if_level_not_high(client, make_service, make_pet, auth_headers):
    # An admin could unblock to allow booking again; while blocked → 409.
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="Medium", blocked=True)
    assert _create(client, auth_headers(owner), svc.id, pet.id).status_code == 409


# ---------------- deposit = 30% (FR-05.3) ----------------
def test_deposit_is_30_percent(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="1500.00")
    owner, pet = make_pet()
    r = _create(client, auth_headers(owner), svc.id, pet.id, qty=2)  # total 1500*2 = 3000
    body = r.json()
    assert Decimal(str(body["totalAmount"]["amount"])) == Decimal("3000.00")
    assert Decimal(str(body["depositAmount"]["amount"])) == Decimal("900.00")  # 30% of 3000


def test_deposit_rounds_half_up(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="999.99")
    owner, pet = make_pet()
    r = _create(client, auth_headers(owner), svc.id, pet.id)  # total 999.99
    # 999.99 * 0.30 = 299.997 → 300.00 (half-up to 2dp)
    assert Decimal(str(r.json()["depositAmount"]["amount"])) == Decimal("300.00")


# ---------------- RBAC on create ----------------
def test_create_booking_is_owner_only(client, make_service, make_pet, make_account, auth_headers):
    svc = make_service(category="Grooming")
    owner, pet = make_pet()
    fd = make_account(role="FrontDesk")
    # front desk cannot create a booking
    assert _create(client, auth_headers(fd), svc.id, pet.id).status_code == 403


# ---------------- availability (FR-03.2/06.2) ----------------
def test_availability_true_when_kennel_free(client, make_service, make_kennel, make_account, auth_headers):
    svc = make_service(category="Lodging", room_type="Standard", price="1000.00")
    make_kennel(room_type="Standard", status="Available")
    owner = make_account(role="Owner")
    start, end = _window()
    r = client.get("/api/v1/bookings/availability", headers=auth_headers(owner),
                   params={"service_item_id": str(svc.id), "start_at": start, "end_at": end})
    assert r.status_code == 200
    assert r.json()["available"] is True


def test_availability_false_when_no_kennel(client, make_service, make_account, auth_headers):
    svc = make_service(category="Lodging", room_type="Deluxe", price="1800.00")
    owner = make_account(role="Owner")
    start, end = _window()
    r = client.get("/api/v1/bookings/availability", headers=auth_headers(owner),
                   params={"service_item_id": str(svc.id), "start_at": start, "end_at": end})
    assert r.json()["available"] is False


# ---------------- over-booking guard (FR-03.2) ----------------
def test_no_double_allocation_of_a_kennel(client, make_service, make_kennel, make_pet, auth_headers):
    svc = make_service(category="Lodging", room_type="Standard", price="1000.00", duration=1440)
    make_kennel(room_type="Standard", status="Available")  # exactly ONE bed
    owner1, pet1 = make_pet(chip_id="900000000000001")
    owner2, pet2 = make_pet(chip_id="900000000000002")

    first = _create(client, auth_headers(owner1), svc.id, pet1.id)
    assert first.status_code == 201
    assert first.json()["status"] == "PendingDeposit"

    second = _create(client, auth_headers(owner2), svc.id, pet2.id)
    assert second.status_code == 409  # no second bed → reject, never over-book


# ---------------- staff review (FR-02.8 / seq5) ----------------
def test_review_approve_moves_to_pending_deposit(client, make_service, make_pet, make_account, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="Medium")
    booking_id = _create(client, auth_headers(owner), svc.id, pet.id).json()["id"]

    fd = make_account(role="FrontDesk")
    # appears in the pending-review queue
    queue = client.get("/api/v1/bookings/pending-review", headers=auth_headers(fd)).json()
    assert any(b["id"] == booking_id for b in queue)

    r = client.post(f"/api/v1/bookings/{booking_id}/review", headers=auth_headers(fd),
                    json={"decision": "Approved", "staffNote": "已電話確認"})
    assert r.status_code == 200
    assert r.json()["status"] == "PendingDeposit"


def test_review_reject_cancels(client, make_service, make_pet, make_account, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet(danger="Medium")
    booking_id = _create(client, auth_headers(owner), svc.id, pet.id).json()["id"]

    fd = make_account(role="FrontDesk")
    r = client.post(f"/api/v1/bookings/{booking_id}/review", headers=auth_headers(fd),
                    json={"decision": "Rejected", "staffNote": "風險過高"})
    assert r.status_code == 200
    assert r.json()["status"] == "Cancelled"


def test_owner_cannot_review(client, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming")
    owner, pet = make_pet(danger="Medium")
    booking_id = _create(client, auth_headers(owner), svc.id, pet.id).json()["id"]
    r = client.post(f"/api/v1/bookings/{booking_id}/review", headers=auth_headers(owner),
                    json={"decision": "Approved"})
    assert r.status_code == 403
