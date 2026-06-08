"""GroomingService — gateway-exposed (GroomingService).

Drives the WorkOrder state machine (Pending→PreCheck→Bathing→Drying→Grooming→
Completed; any stage → Aborted on emergency, FR-06.3 / seq3), photo upload
(FR-04.2), and per-stage owner notifications (FR-04.5). Starting the first work
order moves its booking CheckedIn→InProgress; completing the last (with no bed
still occupied) completes the booking.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import STAFF_ROLES, Principal
from app.modules.audit.models import AuditActionType
from app.modules.audit.service import audit_service
from app.modules.booking import resources as res
from app.modules.booking.models import BookedPet, Booking, BookingItem, BookingStatus
from app.modules.booking.state import assert_booking_transition
from app.modules.grooming import schemas as s
from app.modules.grooming.models import EmergencyEvent, WorkOrder, WorkPhoto, WorkStatus
from app.modules.notification.models import NotificationType
from app.modules.notification.service import notification_service

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

# WorkOrder (7 states, SDD §4.4): linear stages + emergency abort from any stage.
WORKORDER_TRANSITIONS: dict[WorkStatus, set[WorkStatus]] = {
    WorkStatus.PENDING: {WorkStatus.PRE_CHECK, WorkStatus.ABORTED},
    WorkStatus.PRE_CHECK: {WorkStatus.BATHING, WorkStatus.ABORTED},
    WorkStatus.BATHING: {WorkStatus.DRYING, WorkStatus.ABORTED},
    WorkStatus.DRYING: {WorkStatus.GROOMING, WorkStatus.ABORTED},
    WorkStatus.GROOMING: {WorkStatus.COMPLETED, WorkStatus.ABORTED},
    WorkStatus.COMPLETED: set(),
    WorkStatus.ABORTED: set(),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def assert_work_transition(current: WorkStatus, target: WorkStatus) -> None:
    if target not in WORKORDER_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Illegal work-order transition: {current.value} → {target.value}",
        )


class GroomingService:
    # ----- helpers -----
    def _work_order_or_404(self, db: Session, work_order_id: uuid.UUID) -> WorkOrder:
        wo = db.get(WorkOrder, work_order_id)
        if wo is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
        return wo

    def _booking_of(self, db: Session, wo: WorkOrder) -> Booking:
        item = db.get(BookingItem, wo.booking_item_id)
        return db.get(Booking, item.booking_id)

    def _readable_work_order_or_404(
        self, db: Session, work_order_id: uuid.UUID, principal: Principal
    ) -> WorkOrder:
        """Staff may read any; an owner only their own booking's work order
        (FR-04.4). 404 (not 403) so existence isn't leaked across owners."""
        wo = self._work_order_or_404(db, work_order_id)
        if not (principal.roles & STAFF_ROLES):
            booking = self._booking_of(db, wo)
            if booking is None or booking.owner_id != principal.account_id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
        return wo

    def _notify_owner(self, db, booking, ntype, title, message) -> None:
        notification_service.notify(
            db,
            recipient_id=booking.owner_id,
            type=ntype,
            title=title,
            message=message,
            booking_id=booking.id,
            mark_sent=True,
        )

    def _audit_status(self, db, wo, operator_id) -> None:
        audit_service.audit(
            db,
            action_type=AuditActionType.SERVICE_STATUS_CHANGED,
            entity_type="WorkOrder",
            entity_id=wo.id,
            operator_id=operator_id,
        )

    # ----- queries -----
    def list_work_orders(self, db: Session) -> list[WorkOrder]:
        return list(
            db.execute(select(WorkOrder).order_by(WorkOrder.created_at)).scalars().all()
        )

    def get_work_order(self, db: Session, work_order_id: uuid.UUID, principal: Principal) -> WorkOrder:
        return self._readable_work_order_or_404(db, work_order_id, principal)

    def list_photos(self, db: Session, work_order_id: uuid.UUID, principal: Principal) -> list[WorkPhoto]:
        self._readable_work_order_or_404(db, work_order_id, principal)
        return list(
            db.execute(
                select(WorkPhoto)
                .where(WorkPhoto.work_order_id == work_order_id)
                .order_by(WorkPhoto.created_at)
            ).scalars().all()
        )

    # ----- lifecycle (seq3) -----
    def start_work_order(self, db: Session, work_order_id: uuid.UUID, groomer_id: uuid.UUID) -> WorkOrder:
        wo = self._work_order_or_404(db, work_order_id)
        assert_work_transition(wo.status, WorkStatus.PRE_CHECK)
        wo.status = WorkStatus.PRE_CHECK
        wo.started_at = _now()
        booking = self._booking_of(db, wo)
        # First started work order moves the booking into service.
        if booking.status == BookingStatus.CHECKED_IN:
            assert_booking_transition(booking.status, BookingStatus.IN_PROGRESS)
            booking.status = BookingStatus.IN_PROGRESS
        self._audit_status(db, wo, groomer_id)
        self._notify_owner(db, booking, NotificationType.SERVICE_STAGE_UPDATED,
                           "服務開始", "美容服務已開始（預檢）。")
        db.commit()
        db.refresh(wo)
        return wo

    def update_stage(
        self, db: Session, work_order_id: uuid.UUID, groomer_id: uuid.UUID, body: s.StageUpdateIn
    ) -> WorkOrder:
        wo = self._work_order_or_404(db, work_order_id)
        target = WorkStatus(body.stage.value)
        assert_work_transition(wo.status, target)
        wo.status = target
        booking = self._booking_of(db, wo)
        self._audit_status(db, wo, groomer_id)
        # FR-04.5 — push a notification on each stage advance.
        self._notify_owner(db, booking, NotificationType.SERVICE_STAGE_UPDATED,
                           "服務進度更新", f"目前階段：{target.value}。")
        db.commit()
        db.refresh(wo)
        return wo

    def complete(self, db: Session, work_order_id: uuid.UUID, groomer_id: uuid.UUID) -> WorkOrder:
        wo = self._work_order_or_404(db, work_order_id)
        assert_work_transition(wo.status, WorkStatus.COMPLETED)
        wo.status = WorkStatus.COMPLETED
        wo.completed_at = _now()
        booking = self._booking_of(db, wo)
        self._audit_status(db, wo, groomer_id)
        self._notify_owner(db, booking, NotificationType.SERVICE_COMPLETED,
                           "服務完成", "美容服務已全部完成，感謝您的惠顧。")
        res.maybe_complete_booking(db, booking, operator_id=groomer_id)
        db.commit()
        db.refresh(wo)
        return wo

    # ----- FR-04.2 photo upload -----
    def upload_photo(
        self, db: Session, work_order_id: uuid.UUID, file: UploadFile
    ) -> WorkPhoto:
        wo = self._work_order_or_404(db, work_order_id)
        ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
        if ext is None:
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Photo must be jpeg/png/webp"
            )
        content = file.file.read()
        if not content:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"File exceeds {settings.max_upload_bytes} bytes",
            )
        rel_path = f"work_photos/{work_order_id}/{uuid.uuid4().hex}{ext}"
        dest = Path(settings.upload_dir) / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)

        photo = WorkPhoto(work_order_id=wo.id, url=rel_path, uploaded_at=_now())
        db.add(photo)
        db.commit()
        db.refresh(photo)
        return photo

    # ----- FR-06.3 / seq3 emergency → Aborted -----
    def trigger_emergency(
        self, db: Session, work_order_id: uuid.UUID, groomer_id: uuid.UUID, body: s.EmergencyTriggerIn
    ) -> EmergencyEvent:
        wo = self._work_order_or_404(db, work_order_id)
        item = db.get(BookingItem, wo.booking_item_id)
        booking = db.get(Booking, item.booking_id)
        booked_pet = db.get(BookedPet, item.booked_pet_id)

        event = EmergencyEvent(
            booking_id=booking.id,
            pet_id=booked_pet.pet_id,
            work_order_id=wo.id,  # grooming-stage emergency carries the work order
            reported_by_id=groomer_id,
            description=body.description,
            occurred_at=_now(),
        )
        db.add(event)
        db.flush()

        # Any stage → Aborted (FR-06.3).
        assert_work_transition(wo.status, WorkStatus.ABORTED)
        wo.status = WorkStatus.ABORTED
        # The booking is aborted too; release any beds (lodging+grooming combos).
        if booking.status in (BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS):
            assert_booking_transition(booking.status, BookingStatus.ABORTED)
            booking.status = BookingStatus.ABORTED
            res.release_booking_resources(db, booking, operator_id=groomer_id)

        audit_service.audit(
            db,
            action_type=AuditActionType.EMERGENCY_TRIGGERED,
            entity_type="EmergencyEvent",
            entity_id=event.id,
            operator_id=groomer_id,
        )
        self._notify_owner(db, booking, NotificationType.EMERGENCY,
                           "緊急醫療事件", f"美容過程發生緊急事件：{body.description}")
        db.commit()
        db.refresh(event)
        return event


grooming_service = GroomingService()
