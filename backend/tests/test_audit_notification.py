"""Cross-cutting service interfaces — AuditService (append) + NotificationService."""
from __future__ import annotations

import uuid

from app.modules.audit.models import AuditActionType, AuditLog
from app.modules.audit.service import audit_service
from app.modules.notification.models import (
    Notification,
    NotificationStatus,
    NotificationType,
)
from app.modules.notification.service import notification_service


def test_audit_service_appends_row(db, make_account):
    operator = make_account(role="Admin")
    pet_id = uuid.uuid4()
    log = audit_service.audit(
        db, AuditActionType.DANGER_LEVEL_UPDATED, "Pet", pet_id, operator.id
    )
    assert log.id is not None
    stored = db.get(AuditLog, log.id)
    assert stored.entity_type == "Pet"
    assert stored.entity_id == str(pet_id)
    assert stored.operator_id == operator.id
    assert stored.action_type == AuditActionType.DANGER_LEVEL_UPDATED


def test_audit_service_accepts_null_operator(db):
    log = audit_service.audit(db, AuditActionType.DANGER_LEVEL_UPDATED, "Pet", uuid.uuid4())
    assert db.get(AuditLog, log.id).operator_id is None


def test_notification_created_pending_by_default(db, make_account):
    recipient = make_account(role="Owner")
    n = notification_service.notify(
        db, recipient.id, NotificationType.BOOKING_CREATED, "預約成立", "您的預約已建立"
    )
    assert n.status == NotificationStatus.PENDING
    assert n.sent_at is None
    assert db.get(Notification, n.id) is not None


def test_notification_mark_sent(db, make_account):
    recipient = make_account(role="Owner")
    n = notification_service.notify(
        db, recipient.id, NotificationType.CHECK_IN_SUCCESS, "報到成功", "已完成報到",
        mark_sent=True,
    )
    assert n.status == NotificationStatus.SENT
    db.refresh(n)
    assert n.sent_at is not None
