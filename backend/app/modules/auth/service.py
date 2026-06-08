"""AuthService — registration, login, password reset, self-profile, and the
admin RBAC / account-management surface (FR-01.*).

Business logic lives here; the router stays thin (HTTP wiring + role guards).
Domain errors are raised as ``HTTPException`` so FastAPI renders them with the
contract's ``{detail}`` error shape. Each method takes the request-scoped
``Session`` and commits its own unit of work.
"""
from __future__ import annotations

import uuid

import jwt
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import (
    ROLE_ADMIN,
    ROLE_OWNER,
    STAFF_ROLES,
    TOKEN_TYPE_RESET,
    create_access_token,
    create_password_reset_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.auth import schemas as s
from app.modules.auth.models import (
    Account,
    AccountStatus,
    Permission,
    Role,
    RoleAssignment,
)


def _get_role_by_name(db: Session, name: str) -> Role:
    role = db.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
    if role is None:  # roles are seeded; a missing role is a deployment error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Role '{name}' is not configured (run the seed script)",
        )
    return role


def _account_roles(account: Account) -> list[str]:
    return [ra.role.name for ra in account.role_assignments]


class AuthService:
    # ----- FR-01.1 registration / login / password reset -----
    def register(self, db: Session, body: s.RegisterIn) -> Account:
        exists = db.execute(
            select(Account.id).where(Account.email == body.email)
        ).first()
        if exists:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

        account = Account(
            email=str(body.email),
            password_hash=hash_password(body.password),
            display_name=body.display_name,
            phone=body.phone,
            status=AccountStatus.ACTIVE,
        )
        db.add(account)
        db.flush()
        # A self-registered user is a pet owner (飼主).
        db.add(RoleAssignment(account_id=account.id, role_id=_get_role_by_name(db, ROLE_OWNER).id))
        db.commit()
        db.refresh(account)
        return account

    def login(self, db: Session, body: s.LoginIn) -> s.TokenOut:
        account = db.execute(
            select(Account)
            .where(Account.email == body.email)
            .options(selectinload(Account.role_assignments))
        ).scalar_one_or_none()
        # Constant-ish: same error whether the email is unknown or the password
        # is wrong, to avoid account enumeration.
        if account is None or not verify_password(body.password, account.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        if account.status != AccountStatus.ACTIVE:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"Account is {account.status.value.lower()}"
            )
        from app.core.config import settings

        token = create_access_token(account.id, _account_roles(account))
        return s.TokenOut(access_token=token, expires_in=settings.jwt_expires_minutes * 60)

    def request_password_reset(self, db: Session, email: str) -> str | None:
        """Issue a reset token for the account if it exists. The caller (router)
        returns a generic message regardless, to avoid account enumeration.
        S4 will deliver this token by email; S2a only mints it (tests mint their
        own via ``create_password_reset_token``)."""
        account = db.execute(
            select(Account).where(Account.email == email)
        ).scalar_one_or_none()
        if account is None:
            return None
        return create_password_reset_token(account.id)

    def confirm_password_reset(self, db: Session, token: str, new_password: str) -> None:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")
        if payload.get("type") != TOKEN_TYPE_RESET:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid reset token")
        try:
            account_id = uuid.UUID(str(payload.get("sub")))
        except (ValueError, TypeError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid reset token")
        account = db.get(Account, account_id)
        if account is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid reset token")
        account.password_hash = hash_password(new_password)
        db.commit()

    # ----- FR-01.4 self profile -----
    def update_profile(self, db: Session, account: Account, body: s.ProfileUpdateIn) -> Account:
        data = body.model_dump(exclude_unset=True)
        if "display_name" in data and data["display_name"] is not None:
            account.display_name = data["display_name"]
        if "phone" in data:
            account.phone = data["phone"]
        db.commit()
        db.refresh(account)
        return account

    # ----- FR-01.2 / FR-01.3 account & RBAC management (admin) -----
    def list_accounts(self, db: Session) -> list[Account]:
        return list(
            db.execute(select(Account).order_by(Account.created_at)).scalars().all()
        )

    def get_account_or_404(self, db: Session, account_id: uuid.UUID) -> Account:
        account = db.get(Account, account_id)
        if account is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
        return account

    def ban_account(
        self, db: Session, account_id: uuid.UUID, actor_id: uuid.UUID
    ) -> Account:
        if account_id == actor_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admins cannot ban themselves")
        account = self.get_account_or_404(db, account_id)
        account.status = AccountStatus.BANNED
        db.commit()
        db.refresh(account)
        # NB: not audited — FR-05.2 / the frozen AuditActionType enum has no
        # AccountBanned value. Flagged to command side (see learning-journey).
        return account

    def unban_account(self, db: Session, account_id: uuid.UUID) -> Account:
        account = self.get_account_or_404(db, account_id)
        account.status = AccountStatus.ACTIVE
        db.commit()
        db.refresh(account)
        return account

    def create_staff(self, db: Session, body: s.StaffCreateIn) -> Account:
        if body.role_name not in STAFF_ROLES:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"role_name must be one of {', '.join(sorted(STAFF_ROLES))}",
            )
        if db.execute(select(Account.id).where(Account.email == body.email)).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
        role = _get_role_by_name(db, body.role_name)
        account = Account(
            email=str(body.email),
            password_hash=hash_password(body.password),
            display_name=body.display_name,
            phone=body.phone,
            status=AccountStatus.ACTIVE,
        )
        db.add(account)
        db.flush()
        db.add(RoleAssignment(account_id=account.id, role_id=role.id))
        db.commit()
        db.refresh(account)
        return account

    def list_roles(self, db: Session) -> list[Role]:
        return list(db.execute(select(Role).order_by(Role.name)).scalars().all())

    def list_permissions(self, db: Session) -> list[Permission]:
        return list(db.execute(select(Permission).order_by(Permission.code)).scalars().all())

    def assign_role(
        self, db: Session, account_id: uuid.UUID, role_id: uuid.UUID
    ) -> RoleAssignment:
        self.get_account_or_404(db, account_id)
        if db.get(Role, role_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
        existing = db.execute(
            select(RoleAssignment).where(
                RoleAssignment.account_id == account_id,
                RoleAssignment.role_id == role_id,
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Role already assigned")
        ra = RoleAssignment(account_id=account_id, role_id=role_id)
        db.add(ra)
        db.commit()
        db.refresh(ra)
        return ra

    def revoke_role(self, db: Session, account_id: uuid.UUID, role_id: uuid.UUID) -> None:
        ra = db.execute(
            select(RoleAssignment).where(
                RoleAssignment.account_id == account_id,
                RoleAssignment.role_id == role_id,
            )
        ).scalar_one_or_none()
        if ra is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Role assignment not found")
        # Safety: never strip the last Admin (would lock everyone out of RBAC).
        role = db.get(Role, role_id)
        if role is not None and role.name == ROLE_ADMIN:
            admin_count = db.execute(
                select(func.count())
                .select_from(RoleAssignment)
                .where(RoleAssignment.role_id == role_id)
            ).scalar_one()
            if admin_count <= 1:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Cannot remove the last Admin"
                )
        db.delete(ra)
        db.commit()

    # ----- FR-01.3 abnormal cancellation report (admin) -----
    def abnormal_cancellation_report(self, db: Session) -> s.CancellationReportOut:
        """Cancelled bookings for admin abuse review (FR-01.3 / NFR-05). Each row
        flags whether the deposit was refunded; un-refunded (late / <24h)
        cancellations are the abuse signal. Cancellation + refund are populated by
        S2b, so this returns an empty set until then — the query is ready."""
        from app.modules.booking.models import Booking, BookingStatus
        from app.modules.payment.models import (
            PaymentStatus,
            PaymentTransaction,
            PaymentType,
        )

        bookings = list(
            db.execute(
                select(Booking)
                .where(
                    Booking.status == BookingStatus.CANCELLED,
                    Booking.cancelled_at.is_not(None),
                )
                .order_by(Booking.cancelled_at.desc())
            ).scalars().all()
        )
        rows: list[s.CancellationReportRow] = []
        for b in bookings:
            refunded = db.execute(
                select(PaymentTransaction.id).where(
                    PaymentTransaction.booking_id == b.id,
                    PaymentTransaction.type == PaymentType.REFUND,
                    PaymentTransaction.status == PaymentStatus.REFUNDED,
                )
            ).first() is not None
            rows.append(
                s.CancellationReportRow(
                    booking_id=b.id,
                    owner_id=b.owner_id,
                    cancelled_at=b.cancelled_at,
                    cancel_reason=b.cancel_reason,
                    refunded=refunded,
                )
            )
        return s.CancellationReportOut(total=len(rows), rows=rows)


auth_service = AuthService()
