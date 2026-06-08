"""Idempotent seed for S1 dev/demo.

Creates: RBAC permissions + 4 roles (Owner/FrontDesk/Groomer/Admin) with grants,
the tiered service catalogue (Standard/Deluxe lodging, Basic/Full grooming), a
few kennels, and one test account per role. Safe to run repeatedly.

    cd backend && .venv/bin/python scripts/seed.py

NB: RBAC grants here are illustrative seed data; real enforcement is S2.
"""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.db.base  # noqa: E402,F401  (register all models before mapper config)
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.modules.auth.models import Account, AccountStatus, Permission, Role, RoleAssignment  # noqa: E402
from app.modules.booking.models import (  # noqa: E402
    GroomingService,
    GroomingType,
    Kennel,
    KennelStatus,
    LodgingService,
    RoomType,
)

TEST_PASSWORD = "Passw0rd!"

PERMISSIONS = {
    "account.read": "查詢帳號",
    "account.ban": "封鎖/解封帳號",
    "rbac.manage": "管理角色與權限",
    "staff.create": "建立員工帳號",
    "audit.read": "查詢稽核/異常取消報告",
    "pet.read": "檢視寵物檔案",
    "pet.write": "建立/編輯寵物檔案",
    "pet.danger.mark_low": "標記低/中度危險",
    "pet.danger.mark_high": "標記高度危險/解封",
    "booking.create": "建立預約",
    "booking.read": "查詢預約",
    "booking.review": "審核待審核預約",
    "booking.cancel": "取消預約",
    "payment.pay": "支付訂金/尾款",
    "checkin.perform": "辦理報到",
    "kennel.manage": "管理床位狀態",
    "grooming.execute": "執行美容工作單",
    "emergency.trigger": "觸發緊急事件",
}

ROLE_GRANTS = {
    "Owner": ["pet.read", "pet.write", "booking.create", "booking.read",
              "booking.cancel", "payment.pay"],
    "FrontDesk": ["pet.read", "pet.danger.mark_low", "booking.read", "booking.review",
                  "payment.pay", "checkin.perform", "kennel.manage", "emergency.trigger"],
    "Groomer": ["pet.read", "pet.danger.mark_low", "grooming.execute", "emergency.trigger"],
    "Admin": ["account.read", "account.ban", "rbac.manage", "staff.create", "audit.read",
              "pet.danger.mark_high", "pet.read", "booking.read"],
}

# NB: domain is *.example.com, not *.local — EmailStr (RegisterIn/AccountOut)
# rejects special-use TLDs like .local, so GET /accounts & /me would fail to
# serialise accounts seeded under @demo.local. (Found in S2a; see learning-journey.)
TEST_ACCOUNTS = [
    ("owner@demo.example.com", "示範飼主", "Owner", "0911000001"),
    ("frontdesk@demo.example.com", "示範櫃台", "FrontDesk", "0911000002"),
    ("groomer@demo.example.com", "示範美容師", "Groomer", "0911000003"),
    ("admin@demo.example.com", "示範管理員", "Admin", "0911000004"),
]

# (name, RoomType, base_price, duration_minutes)
LODGING = [("標準房", RoomType.STANDARD, "1000.00", 1440), ("豪華房", RoomType.DELUXE, "1800.00", 1440)]
# (name, GroomingType, base_price, duration_minutes)
GROOMING = [("基礎美容", GroomingType.BASIC, "800.00", 60), ("完整美容", GroomingType.FULL, "1500.00", 120)]

KENNELS = [("A-01", RoomType.STANDARD), ("A-02", RoomType.STANDARD),
           ("A-03", RoomType.STANDARD), ("B-01", RoomType.DELUXE), ("B-02", RoomType.DELUXE)]


def seed() -> None:
    db = SessionLocal()
    created = {"permissions": 0, "roles": 0, "accounts": 0, "services": 0, "kennels": 0}
    try:
        # --- permissions ---
        perms: dict[str, Permission] = {}
        for code, desc in PERMISSIONS.items():
            p = db.query(Permission).filter_by(code=code).first()
            if not p:
                p = Permission(code=code, description=desc)
                db.add(p)
                created["permissions"] += 1
            perms[code] = p
        db.flush()

        # --- roles + grants ---
        roles: dict[str, Role] = {}
        for name, grant_codes in ROLE_GRANTS.items():
            r = db.query(Role).filter_by(name=name).first()
            if not r:
                r = Role(name=name)
                db.add(r)
                created["roles"] += 1
            r.permissions = [perms[c] for c in grant_codes]  # idempotent reset
            roles[name] = r
        db.flush()

        # --- test accounts + role assignment ---
        for email, display, role_name, phone in TEST_ACCOUNTS:
            acc = db.query(Account).filter_by(email=email).first()
            if not acc:
                acc = Account(email=email, password_hash=hash_password(TEST_PASSWORD),
                              display_name=display, phone=phone, status=AccountStatus.ACTIVE)
                db.add(acc)
                db.flush()
                created["accounts"] += 1
            if not db.query(RoleAssignment).filter_by(account_id=acc.id, role_id=roles[role_name].id).first():
                db.add(RoleAssignment(account_id=acc.id, role_id=roles[role_name].id))

        # --- service catalogue ---
        for name, rtype, price, dur in LODGING:
            if not db.query(LodgingService).filter_by(name=name).first():
                db.add(LodgingService(name=name, room_type=rtype,
                                      base_price=Decimal(price), currency="TWD", duration_minutes=dur))
                created["services"] += 1
        for name, gtype, price, dur in GROOMING:
            if not db.query(GroomingService).filter_by(name=name).first():
                db.add(GroomingService(name=name, grooming_type=gtype,
                                       base_price=Decimal(price), currency="TWD", duration_minutes=dur))
                created["services"] += 1

        # --- kennels ---
        for number, rtype in KENNELS:
            if not db.query(Kennel).filter_by(kennel_number=number).first():
                db.add(Kennel(kennel_number=number, type=rtype, status=KennelStatus.AVAILABLE))
                created["kennels"] += 1

        db.commit()
    finally:
        db.close()

    print("Seed complete (idempotent). Newly created:")
    for k, v in created.items():
        print(f"  {k:12} +{v}")
    print(f"\nTest accounts (password: {TEST_PASSWORD!r}):")
    for email, _, role_name, _ in TEST_ACCOUNTS:
        print(f"  {role_name:10} {email}")


if __name__ == "__main__":
    seed()
