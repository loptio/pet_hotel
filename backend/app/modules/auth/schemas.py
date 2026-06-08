"""Auth & Account/RBAC request/response schemas (Pydantic v2, camelCase)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.common.schemas import CamelModel
from app.modules.auth.models import AccountStatus


# ----- Accounts / profile -----
class AccountOut(CamelModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    phone: str | None = None
    status: AccountStatus
    created_at: datetime


class RegisterIn(CamelModel):
    email: EmailStr
    password: str = Field(..., min_length=8, examples=["P@ssw0rd!"])
    display_name: str = Field(..., examples=["王小明"])
    phone: str | None = Field(default=None, examples=["0912345678"])


class LoginIn(CamelModel):
    email: EmailStr
    password: str = Field(..., examples=["P@ssw0rd!"])


class TokenOut(CamelModel):
    access_token: str = Field(..., examples=["<jwt>"])
    token_type: str = "bearer"
    expires_in: int = Field(..., examples=[3600])


class PasswordResetRequestIn(CamelModel):
    email: EmailStr


class PasswordResetConfirmIn(CamelModel):
    token: str
    new_password: str = Field(..., min_length=8)


class ProfileUpdateIn(CamelModel):
    """FR-01.4 — users may edit their own name + phone."""

    display_name: str | None = None
    phone: str | None = None


# ----- RBAC -----
class RoleOut(CamelModel):
    id: uuid.UUID
    name: str


class PermissionOut(CamelModel):
    id: uuid.UUID
    code: str
    description: str | None = None


class RoleAssignmentOut(CamelModel):
    id: uuid.UUID
    account_id: uuid.UUID
    role_id: uuid.UUID
    assigned_at: datetime


class AssignRoleIn(CamelModel):
    role_id: uuid.UUID


class StaffCreateIn(CamelModel):
    """FR-01.2 — admin creates a staff account with a role."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str
    phone: str | None = None
    role_name: str = Field(..., examples=["FrontDesk"], description="FrontDesk | Groomer | Admin")


class BanAccountIn(CamelModel):
    reason: str | None = Field(default=None, examples=["異常取消過多"])


# ----- FR-01.3 abnormal cancellation report -----
class CancellationReportRow(CamelModel):
    booking_id: uuid.UUID
    owner_id: uuid.UUID
    cancelled_at: datetime
    cancel_reason: str | None = None
    refunded: bool


class CancellationReportOut(CamelModel):
    total: int
    rows: list[CancellationReportRow]
