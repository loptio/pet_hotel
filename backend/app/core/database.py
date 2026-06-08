"""SQLAlchemy 2.0 engine, session, declarative Base + shared mixins.

Conventions (CLAUDE.md / SDD §3.5):
- every entity has a UUID primary key;
- entities carry created_at / updated_at unless append-only;
- the engine is created lazily — importing this module does NOT open a
  connection, so the app + /docs come up without PostgreSQL running.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, create_engine, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    declared_attr,
    mapped_column,
    sessionmaker,
)

from app.core.config import settings

engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base shared by every module's models."""


def pg_enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """Native PostgreSQL enum whose labels are the *values* from the class
    diagram (e.g. ``"None"``, ``"PendingDeposit"``), not the Python member
    names. Keeps the DB enum labels identical to the authoritative model.
    """
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda e: [member.value for member in e],
        native_enum=True,
        validate_strings=True,
    )


class UUIDPrimaryKey:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CreatedAtMixin:
    """For append-only / immutable records (MedicalRecord, AuditLog, photos,
    proof documents) — created_at only, no updated_at."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


def get_db():
    """FastAPI dependency. Unused by S1 stubs (they raise 501 before touching
    the DB) but provided for S2."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
