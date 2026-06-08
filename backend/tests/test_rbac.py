"""RBAC authorization — unit (require_roles logic) + integration (endpoint gating)."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException

from app.core.security import (
    Principal,
    create_access_token,
    create_password_reset_token,
    require_roles,
)
from app.modules.auth.models import AccountStatus


# ---------------- unit: require_roles ----------------
def _principal(*roles: str) -> Principal:
    return Principal(account_id=uuid.uuid4(), email="x@test.local", roles=frozenset(roles))


def test_require_roles_allows_when_role_present():
    dep = require_roles("Admin")
    p = _principal("Admin")
    assert dep(principal=p) is p


def test_require_roles_allows_any_of_several():
    dep = require_roles("FrontDesk", "Groomer", "Admin")
    assert dep(principal=_principal("Groomer")).roles == frozenset({"Groomer"})


def test_require_roles_denies_when_role_absent():
    dep = require_roles("Admin")
    with pytest.raises(HTTPException) as ei:
        dep(principal=_principal("Owner"))
    assert ei.value.status_code == 403


def test_require_roles_denies_when_no_roles():
    dep = require_roles("Owner")
    with pytest.raises(HTTPException) as ei:
        dep(principal=_principal())
    assert ei.value.status_code == 403


# ---------------- integration: endpoint gating ----------------
def test_no_token_is_401(client):
    assert client.get("/api/v1/auth/accounts").status_code == 401


def test_garbage_token_is_401(client):
    r = client.get("/api/v1/auth/accounts", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_reset_token_cannot_authenticate(client, make_account):
    """A password-reset token must not be usable as an access token (wrong type)."""
    acc = make_account(role="Admin")
    token = create_password_reset_token(acc.id)
    r = client.get("/api/v1/auth/accounts", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_owner_forbidden_from_admin_endpoint(client, make_account, auth_headers):
    owner = make_account(role="Owner")
    r = client.get("/api/v1/auth/accounts", headers=auth_headers(owner))
    assert r.status_code == 403


def test_admin_allowed_on_admin_endpoint(client, make_account, auth_headers):
    admin = make_account(role="Admin")
    r = client.get("/api/v1/auth/accounts", headers=auth_headers(admin))
    assert r.status_code == 200


def test_groomer_forbidden_from_owner_endpoint(client, make_account, auth_headers):
    """Listing 'my pets' is Owner-only; a groomer is rejected."""
    groomer = make_account(role="Groomer")
    r = client.get("/api/v1/pets", headers=auth_headers(groomer))
    assert r.status_code == 403


def test_banned_account_token_is_403(client, make_account, auth_headers):
    banned = make_account(role="Owner", status=AccountStatus.BANNED)
    r = client.get("/api/v1/auth/me", headers=auth_headers(banned))
    assert r.status_code == 403


def test_role_change_takes_effect_without_reissuing_token(client, db, make_account, auth_headers):
    """Authorization resolves roles from the DB, so a fresh Owner token is denied
    admin access even though authentication itself succeeds."""
    owner = make_account(role="Owner")
    headers = auth_headers(owner)
    assert client.get("/api/v1/auth/accounts", headers=headers).status_code == 403
    # grant Admin in the DB (same transaction) → same token now authorized
    from sqlalchemy import select
    from app.modules.auth.models import Role, RoleAssignment

    admin_role = db.execute(select(Role).where(Role.name == "Admin")).scalar_one()
    db.add(RoleAssignment(account_id=owner.id, role_id=admin_role.id))
    db.flush()
    # In prod each request gets a fresh session; here the test shares one session
    # with the app, so expire the identity map to mimic that fresh-load view.
    db.expire_all()
    assert client.get("/api/v1/auth/accounts", headers=headers).status_code == 200
