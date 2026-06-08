"""Test fixtures — fast, isolated, independent.

Strategy:
- A dedicated test database (``pethotel_test``) on the same PostgreSQL instance,
  so native enums + the audit append-only trigger behave exactly as in prod.
- Schema is built once per session (clean ``public`` schema → create_all → audit
  trigger → seed RBAC reference data).
- Each test runs inside an outer transaction with ``join_transaction_mode=
  "create_savepoint"``, rolled back at the end. Service ``commit()`` calls land on
  a savepoint, so every test is isolated and nothing persists between tests.
- The FastAPI ``get_db`` dependency is overridden to use the test session, so API
  calls and direct DB setup share one transaction.
"""
from __future__ import annotations

import os
import uuid

import pytest

# Point the app at the test DB *before* importing anything that reads settings.
TEST_DATABASE_URL = "postgresql+psycopg://pethotel:pethotel@localhost:5433/pethotel_test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, select, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.database import get_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402  (imports all models → full metadata)
from app.main import app  # noqa: E402
from app.modules.auth.models import (  # noqa: E402
    Account,
    AccountStatus,
    Permission,
    Role,
    RoleAssignment,
)

_ADMIN_DSN = "host=localhost port=5433 dbname=pethotel user=pethotel password=pethotel"
_TEST_DB = "pethotel_test"

# Mirrors the AuditLog append-only guard in the initial Alembic migration so the
# test schema (create_all) carries the same DB-level immutability (FR-05.2).
_AUDIT_TRIGGER_SQL = [
    """
    CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'audit_logs is append-only (FR-05.2): % is not permitted', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
    """,
    "DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs;",
    """
    CREATE TRIGGER audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
    """,
]


def _ensure_test_db() -> None:
    with psycopg.connect(_ADMIN_DSN, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (_TEST_DB,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{_TEST_DB}"')


def _seed_rbac(engine) -> None:
    """Seed the 4 roles + permission catalogue (reference data), reusing the same
    grants as scripts/seed.py so tests exercise the real RBAC setup."""
    from scripts.seed import PERMISSIONS, ROLE_GRANTS

    with Session(engine) as db:
        perms: dict[str, Permission] = {}
        for code, desc in PERMISSIONS.items():
            p = Permission(code=code, description=desc)
            db.add(p)
            perms[code] = p
        db.flush()
        for name, codes in ROLE_GRANTS.items():
            db.add(Role(name=name, permissions=[perms[c] for c in codes]))
        db.commit()


@pytest.fixture(scope="session")
def engine():
    _ensure_test_db()
    eng = create_engine(TEST_DATABASE_URL, future=True)
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(eng)
    with eng.begin() as conn:
        for stmt in _AUDIT_TRIGGER_SQL:
            conn.execute(text(stmt))
    _seed_rbac(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    """Function-scoped transactional session; everything rolls back after the test."""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()


@pytest.fixture
def client(db):
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def make_account(db):
    """Create an account with a role directly in the DB (bypasses the API).
    Returns the Account; capture its .id early if you'll commit later."""

    def _make(
        role: str | None = "Owner",
        email: str | None = None,
        password: str = "Passw0rd!",
        display_name: str = "Test User",
        status: AccountStatus = AccountStatus.ACTIVE,
    ) -> Account:
        account = Account(
            email=email or f"{uuid.uuid4().hex[:10]}@example.com",
            password_hash=hash_password(password),
            display_name=display_name,
            status=status,
        )
        db.add(account)
        db.flush()
        if role is not None:
            r = db.execute(select(Role).where(Role.name == role)).scalar_one()
            db.add(RoleAssignment(account_id=account.id, role_id=r.id))
            db.flush()
        return account

    return _make


@pytest.fixture
def auth_headers():
    """Bearer header for an account. Roles are resolved from the DB by the auth
    dependency, so the token's role snapshot is intentionally left empty — this
    also proves authorization reads roles from the DB, not the token."""

    def _headers(account: Account) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(account.id)}"}

    return _headers
