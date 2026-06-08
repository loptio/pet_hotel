"""Account & Authorization package (class diagram §1).

Account ⇆ Role many-to-many via RoleAssignment; Role ⇆ Permission via the
``role_permissions`` association (standard RBAC — permissions reusable across
roles). Soft-delete is expressed through AccountStatus (Disabled), never a
physical delete.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Table, Column, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKey, pg_enum


class AccountStatus(str, enum.Enum):
    ACTIVE = "Active"
    BANNED = "Banned"
    DISABLED = "Disabled"


# Role ⇆ Permission (many-to-many)
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("permissions.id"), primary_key=True),
)


class Account(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "accounts"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[AccountStatus] = mapped_column(
        pg_enum(AccountStatus, "account_status"), default=AccountStatus.ACTIVE, nullable=False
    )

    pets: Mapped[list["Pet"]] = relationship(back_populates="owner")  # noqa: F821
    role_assignments: Mapped[list["RoleAssignment"]] = relationship(back_populates="account")


class Role(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)

    permissions: Mapped[list["Permission"]] = relationship(
        secondary=role_permissions, back_populates="roles"
    )
    assignments: Mapped[list["RoleAssignment"]] = relationship(back_populates="role")


class Permission(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permissions, back_populates="permissions"
    )


class RoleAssignment(UUIDPrimaryKey, CreatedAtMixin, Base):
    """Join entity Account ⇆ Role (carries assignedAt)."""

    __tablename__ = "role_assignments"

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    account: Mapped["Account"] = relationship(back_populates="role_assignments")
    role: Mapped["Role"] = relationship(back_populates="assignments")
