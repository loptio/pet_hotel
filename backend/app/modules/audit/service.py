"""AuditService — internal module (no external router).

Append-only writer for the immutable AuditLog (FR-05.2). S2a wires it
synchronously (called in-process by other services); async consumption from
RabbitMQ is S4. The DB-level trigger (see the initial migration) rejects any
UPDATE/DELETE, so audit rows are immutable regardless of caller.

S2a only emits ``DangerLevelUpdated`` (pet danger-level changes). Other action
types are written by their owning flows in S2b (booking / check-in / grooming /
payment / emergency).
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.modules.audit.models import AuditActionType, AuditLog


class AuditService:
    def audit(
        self,
        db: Session,
        action_type: AuditActionType,
        entity_type: str,
        entity_id: uuid.UUID | str,
        operator_id: uuid.UUID | None = None,
    ) -> AuditLog:
        """Append one immutable audit row. Flushed (not committed) so it shares
        the caller's transaction — the audit and the audited change commit or
        roll back together."""
        log = AuditLog(
            action_type=action_type,
            entity_type=entity_type,
            entity_id=str(entity_id),
            operator_id=operator_id,
        )
        db.add(log)
        db.flush()
        return log


audit_service = AuditService()
