"""Cancellation + 24h refund rule (FR-03.3 / 05.4, seq4)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal


def _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel,
            *, hours_ahead=72, category="Grooming", price="1000.00", with_kennel=False, pay=True):
    svc = make_service(category=category, price=price,
                       duration=1440 if category == "Lodging" else 60)
    kennel = make_kennel(room_type="Standard", status="Available") if with_kennel else None
    owner, pet = make_pet()
    start = (datetime.now(timezone.utc) + timedelta(hours=hours_ahead)).replace(microsecond=0)
    end = start + timedelta(hours=2)
    bid = client.post("/api/v1/bookings", headers=auth_headers(owner), json={
        "startAt": start.isoformat(), "endAt": end.isoformat(),
        "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
    }).json()["id"]
    if pay:
        client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_headers(owner),
                    json={"paymentMethod": "Online"})
    return dict(owner=owner, pet=pet, booking_id=bid, kennel=kennel, svc=svc)


def _cancel(client, auth_headers, owner, bid, reason="臨時有事"):
    return client.post(f"/api/v1/cancellation/bookings/{bid}", headers=auth_headers(owner),
                       json={"reason": reason})


def test_cancel_more_than_24h_full_refund(client, make_service, make_pet, make_account,
                                          auth_headers, make_kennel):
    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel,
                 hours_ahead=72, price="1000.00")
    r = _cancel(client, auth_headers, c["owner"], c["booking_id"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["booking"]["status"] == "Cancelled"
    assert body["refund"]["eligible"] is True
    assert body["refund"]["status"] == "Refunded"
    assert Decimal(str(body["refund"]["amount"]["amount"])) == Decimal("300.00")  # 30% of 1000


def test_cancel_within_24h_no_refund(client, make_service, make_pet, make_account,
                                     auth_headers, make_kennel):
    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel,
                 hours_ahead=10, price="1000.00")
    r = _cancel(client, auth_headers, c["owner"], c["booking_id"])
    assert r.status_code == 200
    assert r.json()["booking"]["status"] == "Cancelled"
    assert r.json()["refund"]["eligible"] is False
    assert r.json()["refund"]["amount"] is None


def test_cancel_pending_deposit_has_nothing_to_refund(client, make_service, make_pet,
                                                      make_account, auth_headers, make_kennel):
    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel,
                 hours_ahead=72, pay=False)  # never paid the deposit
    r = _cancel(client, auth_headers, c["owner"], c["booking_id"])
    assert r.status_code == 200
    assert r.json()["booking"]["status"] == "Cancelled"
    assert r.json()["refund"]["eligible"] is False


def test_cancel_releases_kennel(client, make_service, make_pet, make_account,
                                auth_headers, make_kennel):
    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel,
                 hours_ahead=72, category="Lodging", price="1000.00", with_kennel=True)
    # confirmed lodging → kennel Reserved; cancel must free it
    _cancel(client, auth_headers, c["owner"], c["booking_id"])
    fd = make_account(role="FrontDesk")
    ks = client.get("/api/v1/checkin/kennels", headers=auth_headers(fd)).json()
    kennel = next(k for k in ks if k["id"] == str(c["kennel"].id))
    assert kennel["status"] == "Available"


def test_cancel_is_owner_only(client, make_service, make_pet, make_account, auth_headers, make_kennel):
    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel)
    fd = make_account(role="FrontDesk")
    assert _cancel(client, auth_headers, fd, c["booking_id"]).status_code == 403


def test_other_owner_cannot_cancel(client, make_service, make_pet, make_account, auth_headers, make_kennel):
    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel)
    intruder = make_account(role="Owner")
    assert _cancel(client, auth_headers, intruder, c["booking_id"]).status_code == 404


def test_cannot_cancel_checked_in_booking(client, make_service, make_pet, make_account,
                                          auth_headers, make_kennel):
    from datetime import date

    c = _confirm(client, make_service, make_pet, make_account, auth_headers, make_kennel,
                 category="Grooming")
    fd = make_account(role="FrontDesk")
    make_account(role="Groomer")  # so a work order can be opened at check-in
    expires = (date.today() + timedelta(days=365)).isoformat()
    client.post(f"/api/v1/checkin/{c['booking_id']}/vaccine", headers=auth_headers(fd),
                json={"petId": str(c["pet"].id), "vaccineName": "狂犬病", "expiresAt": expires})
    client.post("/api/v1/checkin", headers=auth_headers(fd),
                json={"bookingId": str(c["booking_id"]), "chipId": "900000000000001"})
    # now CheckedIn → not cancellable
    assert _cancel(client, auth_headers, c["owner"], c["booking_id"]).status_code == 409
