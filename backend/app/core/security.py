"""Auth primitives — JWT issuance/verification, password hashing, RBAC (S2a).

Replaces the S1 stub. Responsibilities:
- ``hash_password`` / ``verify_password`` — bcrypt (used by register/login/seed).
- ``create_access_token`` / ``create_password_reset_token`` / ``decode_token`` — JWT.
- ``get_current_principal`` — FastAPI dependency that verifies the bearer JWT,
  loads the account from the DB, rejects banned/disabled accounts, and resolves
  the caller's roles *fresh from the DB* (so ban / role changes take effect
  immediately, not only at next login).
- ``require_roles(*roles)`` — dependency factory enforcing per-endpoint RBAC by
  the 4 roles (Owner / FrontDesk / Groomer / Admin), per contracts/api-overview.md.

RBAC is role-based (the 4 seeded roles). The Permission catalogue is reference
data exposed via /auth/permissions; finer permission-level gating is future work.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.database import get_db

# ----- role names (must match the seeded Role.name values) -----
ROLE_OWNER = "Owner"
ROLE_FRONTDESK = "FrontDesk"
ROLE_GROOMER = "Groomer"
ROLE_ADMIN = "Admin"
STAFF_ROLES = frozenset({ROLE_FRONTDESK, ROLE_GROOMER, ROLE_ADMIN})
ALL_ROLES = frozenset({ROLE_OWNER, *STAFF_ROLES})

# JWT token "type" claim — keeps access tokens and reset tokens from being
# interchangeable (a reset token must not authenticate API calls, and vice versa).
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_RESET = "password_reset"

# Description kept identical to the frozen S1 contract so contracts/openapi.json
# is untouched by S2a (the surface is unchanged; only the bodies became real).
bearer_scheme = HTTPBearer(auto_error=False, description="Bearer JWT (enforced in S2)")


# ----- password hashing -----
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ----- JWT -----
def _encode(claims: dict, expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {**claims, "iat": now, "exp": now + timedelta(minutes=expires_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(account_id: uuid.UUID | str, roles: list[str] | None = None) -> str:
    """Access token. Carries roles as a snapshot for convenience, but the RBAC
    dependency re-resolves roles from the DB authoritatively."""
    return _encode(
        {"sub": str(account_id), "type": TOKEN_TYPE_ACCESS, "roles": list(roles or [])},
        settings.jwt_expires_minutes,
    )


def create_password_reset_token(account_id: uuid.UUID | str) -> str:
    return _encode(
        {"sub": str(account_id), "type": TOKEN_TYPE_RESET},
        settings.password_reset_expires_minutes,
    )


def decode_token(token: str) -> dict:
    """Decode + verify signature/expiry. Raises ``jwt.PyJWTError`` on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# ----- authenticated principal -----
@dataclass(frozen=True)
class Principal:
    """The verified caller. Roles are resolved fresh from the DB on every request."""

    account_id: uuid.UUID
    email: str
    roles: frozenset[str]


_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Principal:
    """Verify the bearer access token and load the live account + roles.

    401 if the token is missing/invalid/expired or the account no longer exists;
    403 if the account is banned/disabled.
    """
    # Imported here to keep the core→module dependency lazy (avoids import cycles).
    from app.modules.auth.models import Account, AccountStatus

    if creds is None or not creds.credentials:
        raise _UNAUTHENTICATED
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise _UNAUTHENTICATED
    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise _UNAUTHENTICATED
    sub = payload.get("sub")
    try:
        account_id = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise _UNAUTHENTICATED

    account = db.execute(
        select(Account)
        .where(Account.id == account_id)
        .options(selectinload(Account.role_assignments))
    ).scalar_one_or_none()
    if account is None:
        raise _UNAUTHENTICATED
    if account.status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {account.status.value.lower()}",
        )

    roles = frozenset(ra.role.name for ra in account.role_assignments)
    return Principal(account_id=account.id, email=account.email, roles=roles)


def require_roles(*allowed: str):
    """Dependency factory: allow the request only if the caller holds at least
    one of ``allowed`` roles. Use as ``Depends(require_roles("Admin"))``; returns
    the Principal so the endpoint can use the caller's identity."""
    allowed_set = frozenset(allowed)

    def _dep(principal: Principal = Depends(get_current_principal)) -> Principal:
        if not (principal.roles & allowed_set):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: requires role {' or '.join(sorted(allowed_set))}",
            )
        return principal

    return _dep
