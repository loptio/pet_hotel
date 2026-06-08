"""Danger-level rules (FR-02.7 / 02.8) + RBAC + auto-block + audit."""
from __future__ import annotations


def _owned_pet(client, make_account, auth_headers):
    owner = make_account(role="Owner")
    h = auth_headers(owner)
    pet_id = client.post("/api/v1/pets", json={"name": "旺財"}, headers=h).json()["id"]
    return owner, pet_id


def _mark(client, pet_id, headers, level, note="note"):
    return client.post(f"/api/v1/pets/{pet_id}/danger-level",
                       json={"dangerLevel": level, "dangerNote": note}, headers=headers)


def test_frontdesk_marks_low(client, make_account, auth_headers):
    _, pet_id = _owned_pet(client, make_account, auth_headers)
    fd = make_account(role="FrontDesk")
    r = _mark(client, pet_id, auth_headers(fd), "Low", "略怕生")
    assert r.status_code == 200
    assert r.json()["dangerLevel"] == "Low"
    assert r.json()["isBlocked"] is False


def test_groomer_marks_medium(client, make_account, auth_headers):
    _, pet_id = _owned_pet(client, make_account, auth_headers)
    groomer = make_account(role="Groomer")
    r = _mark(client, pet_id, auth_headers(groomer), "Medium")
    assert r.status_code == 200 and r.json()["dangerLevel"] == "Medium"


def test_frontdesk_cannot_mark_high(client, make_account, auth_headers):
    _, pet_id = _owned_pet(client, make_account, auth_headers)
    fd = make_account(role="FrontDesk")
    r = _mark(client, pet_id, auth_headers(fd), "High", "咬人")
    assert r.status_code == 403


def test_owner_cannot_mark_danger(client, make_account, auth_headers):
    owner = make_account(role="Owner")
    h = auth_headers(owner)
    pet_id = client.post("/api/v1/pets", json={"name": "旺財"}, headers=h).json()["id"]
    assert _mark(client, pet_id, h, "Low").status_code == 403


def test_admin_marks_high_autoblocks_and_audits(client, db, make_account, auth_headers):
    _, pet_id = _owned_pet(client, make_account, auth_headers)
    admin = make_account(role="Admin")
    r = _mark(client, pet_id, auth_headers(admin), "High", "曾咬傷工作人員")
    assert r.status_code == 200
    assert r.json()["dangerLevel"] == "High"
    assert r.json()["isBlocked"] is True  # FR-02.8 auto-block

    from sqlalchemy import func, select
    from app.modules.audit.models import AuditActionType, AuditLog

    n = db.execute(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.entity_id == pet_id,
            AuditLog.action_type == AuditActionType.DANGER_LEVEL_UPDATED,
        )
    ).scalar_one()
    assert n >= 1


def test_blocked_pet_only_modifiable_by_admin(client, make_account, auth_headers):
    _, pet_id = _owned_pet(client, make_account, auth_headers)
    admin = make_account(role="Admin")
    assert _mark(client, pet_id, auth_headers(admin), "High").status_code == 200  # now blocked
    # a blocked (high-risk) pet can't be quietly downgraded by front desk
    fd = make_account(role="FrontDesk")
    assert _mark(client, pet_id, auth_headers(fd), "Low").status_code == 403


def test_unblock_is_admin_only(client, make_account, auth_headers):
    _, pet_id = _owned_pet(client, make_account, auth_headers)
    admin = make_account(role="Admin")
    _mark(client, pet_id, auth_headers(admin), "High")

    fd = make_account(role="FrontDesk")
    assert client.post(f"/api/v1/pets/{pet_id}/unblock", headers=auth_headers(fd)).status_code == 403

    r = client.post(f"/api/v1/pets/{pet_id}/unblock", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["isBlocked"] is False
    # danger_level is kept as the historical record (booking gate keys on isBlocked)
    assert r.json()["dangerLevel"] == "High"
