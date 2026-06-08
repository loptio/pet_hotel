"""NotificationService — internal module (no external router).

S2a provides the interface to *create* Notification records synchronously
(in-process). Async delivery (RabbitMQ → FCM/APNs) is wired in S4; until then a
record is created with status Pending (queued) or, when ``mark_sent`` is set,
Sent. Booking/check-in/grooming flows in S2b call this on their state changes.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.notification.models import (
    Notification,
    NotificationStatus,
    NotificationType,
)


class NotificationService:
    def notify(
        self,
        db: Session,
        recipient_id: uuid.UUID,
        type: NotificationType,
        title: str,
        message: str,
        booking_id: uuid.UUID | None = None,
        mark_sent: bool = False,
    ) -> Notification:
        """Create one Notification record (synchronous write). Flushed into the
        caller's transaction so it commits/rolls back with the triggering change."""
        notification = Notification(
            recipient_id=recipient_id,
            booking_id=booking_id,
            type=type,
            title=title,
            message=message,
            status=NotificationStatus.SENT if mark_sent else NotificationStatus.PENDING,
            sent_at=func.now() if mark_sent else None,
        )
        db.add(notification)
        db.flush()
        return notification


notification_service = NotificationService()
