"""Auth flow integration — register / login / me / password reset / ban."""
from __future__ import annotations

from app.core.security import create_password_reset_token

REG = {"email": "owner1@example.com", "password": "Passw0rd!", "displayName": "王小明",
       "phone": "0912345678"}


def test_register_then_login_then_me(client):
    r = client.post("/api/v1/auth/register", json=REG)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == REG["email"]
    assert body["status"] == "Active"
    assert body["displayName"] == "王小明"

    r = client.post("/api/v1/auth/login", json={"email": REG["email"], "password": REG["password"]})
    assert r.status_code == 200, r.text
    token = r.json()["accessToken"]
    assert r.json()["tokenType"] == "bearer"

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == REG["email"]


def test_register_duplicate_email_409(client):
    assert client.post("/api/v1/auth/register", json=REG).status_code == 201
    assert client.post("/api/v1/auth/register", json=REG).status_code == 409


def test_login_wrong_password_401(client):
    client.post("/api/v1/auth/register", json=REG)
    r = client.post("/api/v1/auth/login", json={"email": REG["email"], "password": "wrong-pass!"})
    assert r.status_code == 401


def test_login_unknown_email_401(client):
    r = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Passw0rd!"})
    assert r.status_code == 401


def test_update_profile(client):
    client.post("/api/v1/auth/register", json=REG)
    token = client.post("/api/v1/auth/login",
                        json={"email": REG["email"], "password": REG["password"]}).json()["accessToken"]
    h = {"Authorization": f"Bearer {token}"}
    r = client.patch("/api/v1/auth/me", json={"displayName": "王大明", "phone": "0900000000"}, headers=h)
    assert r.status_code == 200
    assert r.json()["displayName"] == "王大明"
    assert r.json()["phone"] == "0900000000"


def test_password_reset_request_is_generic_and_resets(client):
    reg = client.post("/api/v1/auth/register", json=REG).json()
    account_id = reg["id"]

    # request returns 200 + generic message regardless (no enumeration)
    r = client.post("/api/v1/auth/password-reset/request", json={"email": REG["email"]})
    assert r.status_code == 200
    r2 = client.post("/api/v1/auth/password-reset/request", json={"email": "ghost@example.com"})
    assert r2.status_code == 200
    assert r.json() == r2.json()

    # confirm with a valid reset token (S4 emails it; here we mint it directly)
    token = create_password_reset_token(account_id)
    r = client.post("/api/v1/auth/password-reset/confirm",
                    json={"token": token, "newPassword": "NewPassw0rd!"})
    assert r.status_code == 200

    # old password rejected, new password works
    assert client.post("/api/v1/auth/login",
                       json={"email": REG["email"], "password": REG["password"]}).status_code == 401
    assert client.post("/api/v1/auth/login",
                       json={"email": REG["email"], "password": "NewPassw0rd!"}).status_code == 200


def test_password_reset_confirm_rejects_bad_token(client):
    r = client.post("/api/v1/auth/password-reset/confirm",
                    json={"token": "garbage", "newPassword": "NewPassw0rd!"})
    assert r.status_code == 400


def test_admin_ban_blocks_login_and_unban_restores(client, make_account, auth_headers):
    admin = make_account(role="Admin")
    victim = make_account(role="Owner", email="victim@example.com")
    victim_id = victim.id
    admin_h = auth_headers(admin)

    r = client.post(f"/api/v1/auth/accounts/{victim_id}/ban", json={"reason": "abuse"}, headers=admin_h)
    assert r.status_code == 200
    assert r.json()["status"] == "Banned"

    # banned account can no longer log in
    assert client.post("/api/v1/auth/login",
                       json={"email": "victim@example.com", "password": "Passw0rd!"}).status_code == 403

    r = client.post(f"/api/v1/auth/accounts/{victim_id}/unban", headers=admin_h)
    assert r.status_code == 200
    assert r.json()["status"] == "Active"
    assert client.post("/api/v1/auth/login",
                       json={"email": "victim@example.com", "password": "Passw0rd!"}).status_code == 200


def test_admin_cannot_ban_self(client, make_account, auth_headers):
    admin = make_account(role="Admin")
    r = client.post(f"/api/v1/auth/accounts/{admin.id}/ban", json={}, headers=auth_headers(admin))
    assert r.status_code == 400


def test_create_staff_and_login(client, make_account, auth_headers):
    admin = make_account(role="Admin")
    r = client.post("/api/v1/auth/staff",
                    json={"email": "fd@example.com", "password": "Passw0rd!",
                          "displayName": "櫃台", "roleName": "FrontDesk"},
                    headers=auth_headers(admin))
    assert r.status_code == 201, r.text
    # the new staff can log in
    assert client.post("/api/v1/auth/login",
                       json={"email": "fd@example.com", "password": "Passw0rd!"}).status_code == 200


def test_create_staff_rejects_owner_role(client, make_account, auth_headers):
    admin = make_account(role="Admin")
    r = client.post("/api/v1/auth/staff",
                    json={"email": "x@example.com", "password": "Passw0rd!",
                          "displayName": "x", "roleName": "Owner"},
                    headers=auth_headers(admin))
    assert r.status_code == 400


def test_roles_and_permissions_listing(client, make_account, auth_headers):
    admin = make_account(role="Admin")
    h = auth_headers(admin)
    roles = client.get("/api/v1/auth/roles", headers=h)
    assert roles.status_code == 200
    assert {r["name"] for r in roles.json()} == {"Owner", "FrontDesk", "Groomer", "Admin"}
    perms = client.get("/api/v1/auth/permissions", headers=h)
    assert perms.status_code == 200 and len(perms.json()) > 0


def test_assign_and_revoke_role(client, db, make_account, auth_headers):
    from sqlalchemy import select
    from app.modules.auth.models import Role

    admin = make_account(role="Admin")
    owner = make_account(role="Owner", email="multi@example.com")
    groomer_role = db.execute(select(Role).where(Role.name == "Groomer")).scalar_one()
    db.flush()
    h = auth_headers(admin)

    r = client.post(f"/api/v1/auth/accounts/{owner.id}/roles",
                    json={"roleId": str(groomer_role.id)}, headers=h)
    assert r.status_code == 200, r.text
    # duplicate assignment → 409
    assert client.post(f"/api/v1/auth/accounts/{owner.id}/roles",
                       json={"roleId": str(groomer_role.id)}, headers=h).status_code == 409
    # revoke
    assert client.delete(f"/api/v1/auth/accounts/{owner.id}/roles/{groomer_role.id}",
                         headers=h).status_code == 200


def test_cannot_remove_last_admin(client, db, make_account, auth_headers):
    from sqlalchemy import select
    from app.modules.auth.models import Role

    admin = make_account(role="Admin")
    admin_role = db.execute(select(Role).where(Role.name == "Admin")).scalar_one()
    db.flush()
    r = client.delete(f"/api/v1/auth/accounts/{admin.id}/roles/{admin_role.id}",
                      headers=auth_headers(admin))
    assert r.status_code == 400


def test_abnormal_cancellation_report_empty(client, make_account, auth_headers):
    """No cancellations yet (cancellation is S2b) → empty but well-formed."""
    admin = make_account(role="Admin")
    r = client.get("/api/v1/auth/reports/abnormal-cancellations", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json() == {"total": 0, "rows": []}
