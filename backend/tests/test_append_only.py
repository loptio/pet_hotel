"""Append-only invariants (FR-02.2 / FR-02.4 / FR-05.2 red lines).

- AuditLog: DB trigger rejects UPDATE/DELETE, allows INSERT.
- MedicalRecord: the API exposes no mutation method (PATCH/DELETE → 405).
- Vaccine proof: covered by test_pet (re-upload → 409).
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditActionType, AuditLog


def _insert_audit(session: Session) -> uuid.UUID:
    log = AuditLog(
        action_type=AuditActionType.DANGER_LEVEL_UPDATED,
        entity_type="Pet",
        entity_id=str(uuid.uuid4()),
    )
    session.add(log)
    session.flush()
    return log.id


def test_audit_log_allows_insert(engine):
    with Session(engine) as s:
        log_id = _insert_audit(s)
        assert s.get(AuditLog, log_id) is not None
        s.rollback()  # rollback (not DELETE) keeps the table append-only & clean


def test_audit_log_rejects_delete(engine):
    with Session(engine) as s:
        log_id = _insert_audit(s)
        with pytest.raises(Exception):
            s.execute(text("DELETE FROM audit_logs WHERE id = :id"), {"id": str(log_id)})
        s.rollback()


def test_audit_log_rejects_update(engine):
    with Session(engine) as s:
        log_id = _insert_audit(s)
        with pytest.raises(Exception):
            s.execute(
                text("UPDATE audit_logs SET entity_type = 'Tampered' WHERE id = :id"),
                {"id": str(log_id)},
            )
        s.rollback()


def test_medical_records_have_no_mutation_methods(client, make_account, auth_headers):
    owner = make_account(role="Owner")
    h = auth_headers(owner)
    pet_id = client.post("/api/v1/pets", json={"name": "旺財"}, headers=h).json()["id"]
    coll = f"/api/v1/pets/{pet_id}/medical-records"
    assert client.post(coll, json={"description": "x"}, headers=h).status_code == 201
    # the records resource is POST + GET only — no way to modify/delete (FR-02.2)
    assert client.patch(coll, json={"description": "y"}, headers=h).status_code == 405
    assert client.delete(coll, headers=h).status_code == 405
