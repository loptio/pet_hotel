"""Check-in (seq2, FR-04.1/06.1) + kennel lifecycle (FR-03.6/06.4) + grooming
work-order machine (FR-04.2/04.5, seq3) + emergency (FR-06.3, SDD §8)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest


def _window(days_ahead=3, length_hours=2):
    start = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).replace(microsecond=0)
    return start.isoformat(), (start + timedelta(hours=length_hours)).isoformat()


@pytest.fixture
def confirmed(client, make_service, make_pet, make_account, auth_headers, make_kennel):
    """Build a Confirmed booking (created + deposit paid) and return the actors."""
    def _make(category="Grooming", room_type="Standard", price="800.00",
              with_kennel=False, chip="900000000000001"):
        svc = make_service(category=category, room_type=room_type, price=price,
                           duration=1440 if category == "Lodging" else 60)
        kennel = make_kennel(room_type=room_type, status="Available") if with_kennel else None
        owner, pet = make_pet(chip_id=chip)
        fd = make_account(role="FrontDesk")
        groomer = make_account(role="Groomer")
        start, end = _window()
        bid = client.post("/api/v1/bookings", headers=auth_headers(owner), json={
            "startAt": start, "endAt": end,
            "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
        }).json()["id"]
        dep = client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_headers(owner),
                          json={"paymentMethod": "Online"})
        assert dep.status_code == 200 and dep.json()["booking"]["status"] == "Confirmed"
        return dict(svc=svc, kennel=kennel, owner=owner, pet=pet, fd=fd, groomer=groomer, booking_id=bid)

    return _make


def _record_vaccine(client, auth_headers, fd, booking_id, pet_id, *, days=365):
    expires = (date.today() + timedelta(days=days)).isoformat()
    return client.post(f"/api/v1/checkin/{booking_id}/vaccine", headers=auth_headers(fd),
                       json={"petId": str(pet_id), "vaccineName": "狂犬病疫苗", "expiresAt": expires})


def _check_in(client, auth_headers, fd, booking_id, chip="900000000000001"):
    return client.post("/api/v1/checkin", headers=auth_headers(fd),
                       json={"bookingId": str(booking_id), "chipId": chip})


# ---------------- check-in (FR-04.1 / 06.1, seq2) ----------------
def test_checkin_success_opens_work_order(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id)
    r = _check_in(client, auth_headers, c["fd"], c["booking_id"])
    assert r.status_code == 200, r.text
    assert r.json()["result"] == "Success"

    # booking is CheckedIn; a Pending work order now exists for the grooming item
    detail = client.get(f"/api/v1/bookings/{c['booking_id']}", headers=auth_headers(c["owner"])).json()
    assert detail["status"] == "CheckedIn"
    wos = client.get("/api/v1/grooming/work-orders", headers=auth_headers(c["groomer"])).json()
    assert len(wos) == 1 and wos[0]["status"] == "Pending"


def test_checkin_blocked_when_vaccine_expired(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id, days=-1)  # expired
    r = _check_in(client, auth_headers, c["fd"], c["booking_id"])
    assert r.status_code == 200
    assert r.json()["result"] == "Blocked"
    assert r.json()["reason"] == "VaccineExpired"
    # booking stays Confirmed (admission paused, FR-06.1)
    verify = client.get(f"/api/v1/checkin/{c['booking_id']}/verify", headers=auth_headers(c["fd"])).json()
    assert verify["status"] == "Confirmed"


def test_checkin_blocked_when_no_vaccine(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    r = _check_in(client, auth_headers, c["fd"], c["booking_id"])
    assert r.status_code == 200 and r.json()["result"] == "Blocked"


def test_checkin_chip_mismatch_is_409(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id)
    r = _check_in(client, auth_headers, c["fd"], c["booking_id"], chip="000000000000000")
    assert r.status_code == 409


def test_checkin_requires_confirmed(client, make_service, make_pet, make_account, auth_headers):
    # a PendingDeposit booking (no deposit) cannot be checked in
    svc = make_service(category="Grooming")
    owner, pet = make_pet()
    fd = make_account(role="FrontDesk")
    start, end = _window()
    bid = client.post("/api/v1/bookings", headers=auth_headers(owner), json={
        "startAt": start, "endAt": end,
        "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
    }).json()["id"]
    assert _check_in(client, auth_headers, fd, bid).status_code == 409


def test_checkin_is_frontdesk_only(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id)
    assert _check_in(client, auth_headers, c["owner"], c["booking_id"]).status_code == 403


def test_counter_vaccine_autoverifies_expiry(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    valid = _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id, days=30)
    assert valid.json()["status"] == "Valid"
    expired = _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id, days=-5)
    assert expired.json()["status"] == "Expired"


# ---------------- kennel lifecycle (FR-03.6/06.4) ----------------
def test_kennel_lifecycle_reserved_occupied_cleaning_available(confirmed, client, auth_headers):
    c = confirmed(category="Lodging", room_type="Standard", price="1000.00", with_kennel=True)
    fd, bid = c["fd"], c["booking_id"]

    def kennel_status():
        ks = client.get("/api/v1/checkin/kennels", headers=auth_headers(fd)).json()
        return next(k for k in ks if k["id"] == str(c["kennel"].id))

    assert kennel_status()["status"] == "Reserved"  # locked at creation (FR-03.2)

    _record_vaccine(client, auth_headers, fd, bid, c["pet"].id)
    assert _check_in(client, auth_headers, fd, bid).json()["result"] == "Success"
    occ = kennel_status()
    assert occ["status"] == "Occupied"
    assert occ["occupiedByPetId"] == str(c["pet"].id)  # FR-03.6 — which pet is where

    assert client.post(f"/api/v1/checkin/{bid}/checkout", headers=auth_headers(fd)).status_code == 200
    assert kennel_status()["status"] == "Cleaning"

    r = client.post(f"/api/v1/checkin/kennels/{c['kennel'].id}/available", headers=auth_headers(fd))
    assert r.status_code == 200 and r.json()["status"] == "Available"
    # checked out → booking Completed
    detail = client.get(f"/api/v1/bookings/{bid}", headers=auth_headers(c["owner"])).json()
    assert detail["status"] == "Completed"


def test_mark_available_requires_cleaning(confirmed, client, auth_headers):
    c = confirmed(category="Lodging", room_type="Standard", with_kennel=True)
    # kennel is Reserved, not Cleaning → 409
    r = client.post(f"/api/v1/checkin/kennels/{c['kennel'].id}/available", headers=auth_headers(c["fd"]))
    assert r.status_code == 409


def test_kennel_illegal_status_patch_is_409(confirmed, client, auth_headers):
    c = confirmed(category="Lodging", room_type="Standard", with_kennel=True)
    # Reserved → Cleaning is not a legal kennel move
    r = client.patch(f"/api/v1/checkin/kennels/{c['kennel'].id}", headers=auth_headers(c["fd"]),
                     json={"status": "Cleaning"})
    assert r.status_code == 409


# ---------------- grooming work-order machine (FR-04.5, seq3) ----------------
def _checked_in_grooming(confirmed, client, auth_headers):
    c = confirmed(category="Grooming")
    _record_vaccine(client, auth_headers, c["fd"], c["booking_id"], c["pet"].id)
    _check_in(client, auth_headers, c["fd"], c["booking_id"])
    wo_id = client.get("/api/v1/grooming/work-orders", headers=auth_headers(c["groomer"])).json()[0]["id"]
    return c, wo_id


def test_four_stage_happy_path(confirmed, client, auth_headers):
    c, wo_id = _checked_in_grooming(confirmed, client, auth_headers)
    g = auth_headers(c["groomer"])

    assert client.post(f"/api/v1/grooming/work-orders/{wo_id}/start", headers=g).json()["status"] == "PreCheck"
    # starting moves the booking InProgress
    assert client.get(f"/api/v1/bookings/{c['booking_id']}",
                      headers=auth_headers(c["owner"])).json()["status"] == "InProgress"

    for stage in ("Bathing", "Drying", "Grooming"):
        r = client.post(f"/api/v1/grooming/work-orders/{wo_id}/stage", headers=g, json={"stage": stage})
        assert r.status_code == 200 and r.json()["status"] == stage

    done = client.post(f"/api/v1/grooming/work-orders/{wo_id}/complete", headers=g)
    assert done.status_code == 200 and done.json()["status"] == "Completed"
    # completing the only work order completes the booking
    assert client.get(f"/api/v1/bookings/{c['booking_id']}",
                      headers=auth_headers(c["owner"])).json()["status"] == "Completed"


def test_cannot_skip_a_stage(confirmed, client, auth_headers):
    c, wo_id = _checked_in_grooming(confirmed, client, auth_headers)
    g = auth_headers(c["groomer"])
    client.post(f"/api/v1/grooming/work-orders/{wo_id}/start", headers=g)
    # PreCheck → Drying skips Bathing → 409
    r = client.post(f"/api/v1/grooming/work-orders/{wo_id}/stage", headers=g, json={"stage": "Drying"})
    assert r.status_code == 409


def test_complete_requires_grooming_stage(confirmed, client, auth_headers):
    c, wo_id = _checked_in_grooming(confirmed, client, auth_headers)
    g = auth_headers(c["groomer"])
    client.post(f"/api/v1/grooming/work-orders/{wo_id}/start", headers=g)  # at PreCheck
    assert client.post(f"/api/v1/grooming/work-orders/{wo_id}/complete", headers=g).status_code == 409


def test_stage_update_is_groomer_only(confirmed, client, auth_headers):
    c, wo_id = _checked_in_grooming(confirmed, client, auth_headers)
    client.post(f"/api/v1/grooming/work-orders/{wo_id}/start", headers=auth_headers(c["groomer"]))
    r = client.post(f"/api/v1/grooming/work-orders/{wo_id}/stage",
                    headers=auth_headers(c["fd"]), json={"stage": "Bathing"})
    assert r.status_code == 403


# ---------------- emergencies (FR-06.3 / SDD §8) ----------------
def test_grooming_emergency_aborts_workorder_and_booking(confirmed, client, auth_headers):
    c, wo_id = _checked_in_grooming(confirmed, client, auth_headers)
    g = auth_headers(c["groomer"])
    client.post(f"/api/v1/grooming/work-orders/{wo_id}/start", headers=g)
    client.post(f"/api/v1/grooming/work-orders/{wo_id}/stage", headers=g, json={"stage": "Bathing"})

    r = client.post(f"/api/v1/grooming/work-orders/{wo_id}/emergency", headers=g,
                    json={"description": "寵物突發抽搐，已送醫"})
    assert r.status_code == 201
    ev = r.json()
    assert ev["workOrderId"] == wo_id  # grooming emergency carries the work order
    assert ev["petId"] == str(c["pet"].id)

    assert client.get(f"/api/v1/grooming/work-orders/{wo_id}",
                      headers=g).json()["status"] == "Aborted"
    assert client.get(f"/api/v1/bookings/{c['booking_id']}",
                      headers=auth_headers(c["owner"])).json()["status"] == "Aborted"


def test_grooming_emergency_requires_description(confirmed, client, auth_headers):
    c, wo_id = _checked_in_grooming(confirmed, client, auth_headers)
    r = client.post(f"/api/v1/grooming/work-orders/{wo_id}/emergency",
                    headers=auth_headers(c["groomer"]), json={"description": ""})
    assert r.status_code == 422  # min_length=1


def test_frontdesk_emergency_lodging_aborts_and_releases(confirmed, client, auth_headers):
    c = confirmed(category="Lodging", room_type="Standard", with_kennel=True)
    fd, bid = c["fd"], c["booking_id"]
    _record_vaccine(client, auth_headers, fd, bid, c["pet"].id)
    _check_in(client, auth_headers, fd, bid)  # kennel Occupied

    r = client.post(f"/api/v1/checkin/{bid}/emergency", headers=auth_headers(fd),
                    json={"petId": str(c["pet"].id), "description": "住宿寵物突發嘔吐"})
    assert r.status_code == 201
    assert r.json()["workOrderId"] is None  # front-desk/lodging event has no work order

    assert client.get(f"/api/v1/bookings/{bid}",
                      headers=auth_headers(c["owner"])).json()["status"] == "Aborted"
    ks = client.get("/api/v1/checkin/kennels", headers=auth_headers(fd)).json()
    kennel = next(k for k in ks if k["id"] == str(c["kennel"].id))
    assert kennel["status"] == "Cleaning"  # bed released for cleaning
