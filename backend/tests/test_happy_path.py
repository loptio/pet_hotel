"""End-to-end happy path + no-show sweep + payment/audit/notification coverage.

Happy path (the demo's core): create → deposit → check-in → grooming 4 stages →
complete; then settle the final balance. Plus the manual no-show sweep (FR-03.5)
and NFR-03 (no card data stored, only a provider txn id)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.modules.audit.models import AuditActionType, AuditLog
from app.modules.booking.models import BookingStatus
from app.modules.booking.service import booking_service
from app.modules.notification.models import Notification, NotificationType
from app.modules.payment.models import PaymentStatus, PaymentTransaction, PaymentType


def _window(days_ahead=3, hours=2):
    start = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).replace(microsecond=0)
    return start.isoformat(), (start + timedelta(hours=hours)).isoformat()


def test_full_grooming_happy_path(client, db, make_service, make_pet, make_account, auth_headers):
    svc = make_service(category="Grooming", price="1500.00")
    owner, pet = make_pet(chip_id="900000000000009")
    fd = make_account(role="FrontDesk")
    groomer = make_account(role="Groomer")
    h_o, h_f, h_g = auth_headers(owner), auth_headers(fd), auth_headers(groomer)

    # create → PendingDeposit
    start, end = _window()
    bid = client.post("/api/v1/bookings", headers=h_o, json={
        "startAt": start, "endAt": end,
        "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
    }).json()["id"]

    # deposit (30% of 1500 = 450) → Confirmed
    dep = client.post(f"/api/v1/bookings/{bid}/deposit", headers=h_o, json={"paymentMethod": "Online"})
    assert dep.status_code == 200
    assert dep.json()["booking"]["status"] == "Confirmed"
    assert dep.json()["payment"]["status"] == "Authorized"
    assert Decimal(str(dep.json()["payment"]["amount"]["amount"])) == Decimal("450.00")

    # counter vaccine (valid) + check-in → Success / CheckedIn
    expires = (date.today() + timedelta(days=365)).isoformat()
    client.post(f"/api/v1/checkin/{bid}/vaccine", headers=h_f,
                json={"petId": str(pet.id), "vaccineName": "狂犬病疫苗", "expiresAt": expires})
    ci = client.post("/api/v1/checkin", headers=h_f,
                     json={"bookingId": bid, "chipId": "900000000000009"})
    assert ci.json()["result"] == "Success"

    # grooming 4 stages → Completed (booking completes too)
    wo_id = client.get("/api/v1/grooming/work-orders", headers=h_g).json()[0]["id"]
    client.post(f"/api/v1/grooming/work-orders/{wo_id}/start", headers=h_g)
    for stage in ("Bathing", "Drying", "Grooming"):
        client.post(f"/api/v1/grooming/work-orders/{wo_id}/stage", headers=h_g, json={"stage": stage})
    assert client.post(f"/api/v1/grooming/work-orders/{wo_id}/complete", headers=h_g).json()["status"] == "Completed"
    assert client.get(f"/api/v1/bookings/{bid}", headers=h_o).json()["status"] == "Completed"

    # settle final balance (1500 - 450 = 1050) on-site
    fin = client.post(f"/api/v1/bookings/{bid}/final-payment", headers=h_o,
                      json={"paymentMethod": "CardOnSite"})
    assert fin.status_code == 200
    assert Decimal(str(fin.json()["payment"]["amount"]["amount"])) == Decimal("1050.00")

    # FR-05.2 audit covers the lifecycle; FR-04.3/04.5 notifications fired
    actions = set(db.execute(select(AuditLog.action_type)).scalars().all())
    assert {AuditActionType.BOOKING_CREATED, AuditActionType.PAYMENT_PROCESSED,
            AuditActionType.CHECK_IN_SUCCESS, AuditActionType.SERVICE_STATUS_CHANGED} <= actions
    ntypes = set(db.execute(select(Notification.type)).scalars().all())
    assert {NotificationType.BOOKING_CREATED, NotificationType.CHECK_IN_SUCCESS,
            NotificationType.SERVICE_STAGE_UPDATED, NotificationType.SERVICE_COMPLETED} <= ntypes


def test_deposit_and_final_record_provider_txn_only(client, db, make_service, make_pet, auth_headers):
    """NFR-03 — payment is not stored locally beyond a provider reference."""
    svc = make_service(category="Grooming", price="1000.00")
    owner, pet = make_pet()
    start, end = _window()
    bid = client.post("/api/v1/bookings", headers=auth_headers(owner), json={
        "startAt": start, "endAt": end,
        "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
    }).json()["id"]
    client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_headers(owner),
                json={"paymentMethod": "Online"})

    txn = db.execute(
        select(PaymentTransaction).where(PaymentTransaction.type == PaymentType.DEPOSIT)
    ).scalars().first()
    assert txn.status == PaymentStatus.AUTHORIZED
    assert txn.provider_txn_id and txn.provider_txn_id.startswith("ECPAY-")
    # the table only carries metadata + a provider reference — no card columns exist
    cols = set(PaymentTransaction.__table__.columns.keys())
    assert not any("card" in c or "pan" in c or "cvv" in c for c in cols)


def test_no_show_sweep_marks_and_releases(client, db, make_service, make_pet, make_account,
                                          auth_headers, make_kennel):
    svc = make_service(category="Lodging", room_type="Standard", price="1000.00", duration=1440)
    kennel = make_kennel(room_type="Standard", status="Available")
    owner, pet = make_pet()
    # a booking whose start is already >2h in the past
    past = (datetime.now(timezone.utc) - timedelta(hours=3)).replace(microsecond=0)
    bid = client.post("/api/v1/bookings", headers=auth_headers(owner), json={
        "startAt": past.isoformat(), "endAt": (past + timedelta(hours=1)).isoformat(),
        "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
    }).json()["id"]
    client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_headers(owner),
                json={"paymentMethod": "Online"})  # Confirmed, kennel Reserved

    swept = booking_service.mark_no_shows(db)
    assert swept >= 1
    assert client.get(f"/api/v1/bookings/{bid}", headers=auth_headers(owner)).json()["status"] == "NoShow"

    fd = make_account(role="FrontDesk")
    ks = client.get("/api/v1/checkin/kennels", headers=auth_headers(fd)).json()
    assert next(k for k in ks if k["id"] == str(kennel.id))["status"] == "Available"


def test_no_show_ignores_future_confirmed(client, db, make_service, make_pet, auth_headers):
    svc = make_service(category="Grooming", price="800.00")
    owner, pet = make_pet()
    start, end = _window(days_ahead=3)
    bid = client.post("/api/v1/bookings", headers=auth_headers(owner), json={
        "startAt": start, "endAt": end,
        "items": [{"serviceItemId": str(svc.id), "petId": str(pet.id), "quantity": 1}],
    }).json()["id"]
    client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_headers(owner),
                json={"paymentMethod": "Online"})
    booking_service.mark_no_shows(db)
    # still Confirmed — start is in the future
    assert client.get(f"/api/v1/bookings/{bid}", headers=auth_headers(owner)).json()["status"] == "Confirmed"
