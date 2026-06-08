"""Auth router — gateway-exposed group "Auth".

AuthService (SDD) + the non-booking Account & Authorization use cases:
register/login/reset (FR-01.1), self-profile (FR-01.4), and the admin RBAC
surface (FR-01.2/01.3). Public endpoints take no auth; everything else is
role-gated per contracts/api-overview.md (admin endpoints require the Admin role).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.common.schemas import MessageOut
from app.core.database import get_db
from app.core.security import Principal, get_current_principal, require_roles
from app.modules.auth import schemas as s
from app.modules.auth.models import Account
from app.modules.auth.service import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])
admin_only = Depends(require_roles("Admin"))


# ----- public (no auth) -----
@router.post("/register", response_model=s.AccountOut, status_code=status.HTTP_201_CREATED,
             summary="Register an owner account (FR-01.1)")
def register(body: s.RegisterIn, db: Session = Depends(get_db)):
    return auth_service.register(db, body)


@router.post("/login", response_model=s.TokenOut, summary="Log in, obtain JWT (FR-01.1)")
def login(body: s.LoginIn, db: Session = Depends(get_db)):
    return auth_service.login(db, body)


@router.post("/password-reset/request", response_model=MessageOut,
             summary="Request a password-reset email (FR-01.1)")
def request_password_reset(body: s.PasswordResetRequestIn, db: Session = Depends(get_db)):
    # Token is minted (delivery by email is S4) but never returned, and the
    # response is identical whether or not the email exists (no enumeration).
    auth_service.request_password_reset(db, str(body.email))
    return MessageOut(message="If the email exists, a reset link has been sent")


@router.post("/password-reset/confirm", response_model=MessageOut,
             summary="Confirm password reset with token (FR-01.1)")
def confirm_password_reset(body: s.PasswordResetConfirmIn, db: Session = Depends(get_db)):
    auth_service.confirm_password_reset(db, body.token, body.new_password)
    return MessageOut(message="Password has been reset")


# ----- self profile (FR-01.4) — any authenticated user -----
@router.get("/me", response_model=s.AccountOut, summary="Get my profile (FR-01.4)")
def get_me(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    return db.get(Account, principal.account_id)


@router.patch("/me", response_model=s.AccountOut, summary="Edit my name / phone (FR-01.4)")
def update_me(
    body: s.ProfileUpdateIn,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    account = db.get(Account, principal.account_id)
    return auth_service.update_profile(db, account, body)


# ----- RBAC / account admin (FR-01.2 / FR-01.3) — Admin only -----
@router.get("/accounts", response_model=list[s.AccountOut], summary="List accounts — admin (FR-01.3)")
def list_accounts(principal: Principal = admin_only, db: Session = Depends(get_db)):
    return auth_service.list_accounts(db)


@router.post("/accounts/{account_id}/ban", response_model=s.AccountOut,
             summary="Ban an account — admin (FR-01.3)")
def ban_account(
    account_id: uuid.UUID,
    body: s.BanAccountIn,
    principal: Principal = admin_only,
    db: Session = Depends(get_db),
):
    return auth_service.ban_account(db, account_id, principal.account_id)


@router.post("/accounts/{account_id}/unban", response_model=s.AccountOut,
             summary="Unban an account — admin (FR-01.3)")
def unban_account(account_id: uuid.UUID, principal: Principal = admin_only, db: Session = Depends(get_db)):
    return auth_service.unban_account(db, account_id)


@router.post("/staff", response_model=s.AccountOut, status_code=status.HTTP_201_CREATED,
             summary="Create a staff account — admin (FR-01.2)")
def create_staff(body: s.StaffCreateIn, principal: Principal = admin_only, db: Session = Depends(get_db)):
    return auth_service.create_staff(db, body)


@router.get("/roles", response_model=list[s.RoleOut], summary="List roles (FR-01.2)")
def list_roles(principal: Principal = admin_only, db: Session = Depends(get_db)):
    return auth_service.list_roles(db)


@router.get("/permissions", response_model=list[s.PermissionOut], summary="List permissions (FR-01.2)")
def list_permissions(principal: Principal = admin_only, db: Session = Depends(get_db)):
    return auth_service.list_permissions(db)


@router.post("/accounts/{account_id}/roles", response_model=s.RoleAssignmentOut,
             summary="Assign a role to an account (FR-01.2)")
def assign_role(
    account_id: uuid.UUID,
    body: s.AssignRoleIn,
    principal: Principal = admin_only,
    db: Session = Depends(get_db),
):
    return auth_service.assign_role(db, account_id, body.role_id)


@router.delete("/accounts/{account_id}/roles/{role_id}", response_model=MessageOut,
               summary="Revoke a role from an account (FR-01.2)")
def revoke_role(
    account_id: uuid.UUID,
    role_id: uuid.UUID,
    principal: Principal = admin_only,
    db: Session = Depends(get_db),
):
    auth_service.revoke_role(db, account_id, role_id)
    return MessageOut(message="Role revoked")


@router.get("/reports/abnormal-cancellations", response_model=s.CancellationReportOut,
            summary="Abnormal cancellation report — admin (FR-01.3)")
def abnormal_cancellation_report(principal: Principal = admin_only, db: Session = Depends(get_db)):
    return auth_service.abnormal_cancellation_report(db)
