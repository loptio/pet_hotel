"""Demo data for the S4 recording — drives the real API (like a user) so every
list screen is populated and every recordable state exists. Idempotent: if the
marker pet (CHIP-CAT-001) already exists for the owner, it exits.

Creates for owner@demo.example.com:
- 3 pets: 咪咪(貓,有效疫苗) · 汪汪(狗,有效疫苗) · 兔兔(兔,逾期疫苗→演報到阻斷) + 虎虎(中度危險→演待審核)
- bookings spanning states: Completed(美容全流程+照片) · CheckedIn(住宿,佔床) · Confirmed(待報到) · PendingDeposit(待付訂金) · PendingReview(中度待審核)

Run AFTER scripts/seed.py and with the API up:
    cd backend && .venv/bin/python scripts/demo_data.py
"""
from __future__ import annotations

import base64
import io
import sys
from datetime import date, datetime, timedelta, timezone

import httpx

BASE = "http://127.0.0.1:8000/api/v1"
PW = "Passw0rd!"
MARKER_CHIP = "CHIP-CAT-001"

# 1x1 transparent PNG for the mock work photo upload
_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def login(c, email):
    r = c.post(f"{BASE}/auth/login", json={"email": email, "password": PW})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


def iso(dt):
    return dt.replace(microsecond=0).isoformat()


def make_pet(c, h, name, species, breed, chip):
    return c.post(
        f"{BASE}/pets", headers=h,
        json={"name": name, "species": species, "breed": breed, "chipId": chip},
    ).json()


def add_vax(c, h, pet_id, name, expires: date):
    c.post(f"{BASE}/pets/{pet_id}/vaccinations", headers=h,
           json={"vaccineName": name, "expiresAt": expires.isoformat(),
                 "administeredAt": (expires - timedelta(days=365)).isoformat()})


def service_by(c, h, category, grooming_type=None, room_type=None):
    items = c.get(f"{BASE}/bookings/services", headers=h, params={"category": category}).json()
    for s in items:
        if grooming_type and s.get("groomingType") == grooming_type:
            return s
        if room_type and s.get("roomType") == room_type:
            return s
    return items[0]


def create_booking(c, h, svc_id, pet_id, start, end, qty=1):
    return c.post(f"{BASE}/bookings", headers=h, json={
        "startAt": iso(start), "endAt": iso(end),
        "items": [{"serviceItemId": svc_id, "petId": pet_id, "quantity": qty}],
    })


def main():
    c = httpx.Client(timeout=15)
    ho = login(c, "owner@demo.example.com")
    hf = login(c, "frontdesk@demo.example.com")
    hg = login(c, "groomer@demo.example.com")

    existing = c.get(f"{BASE}/pets", headers=ho).json()
    if any(p.get("chipId") == MARKER_CHIP for p in existing):
        print("demo data already present (marker pet found) — skipping.")
        return

    now = datetime.now(timezone.utc)
    today = date.today()

    # ---- pets ----
    cat = make_pet(c, ho, "咪咪", "Cat", "美國短毛貓", MARKER_CHIP)
    dog = make_pet(c, ho, "汪汪", "Dog", "柴犬", "CHIP-DOG-002")
    rabbit = make_pet(c, ho, "兔兔", "Rabbit", "道奇兔", "CHIP-RAB-003")
    tiger = make_pet(c, ho, "虎虎", "Dog", "米克斯", "CHIP-DOG-004")
    add_vax(c, ho, cat["id"], "FVRCP 三合一", today + timedelta(days=300))
    add_vax(c, ho, dog["id"], "狂犬病疫苗", today + timedelta(days=200))
    add_vax(c, ho, rabbit["id"], "兔病毒性出血症", today - timedelta(days=20))  # 逾期
    print("pets: 咪咪 / 汪汪 / 兔兔(逾期疫苗) / 虎虎")

    groom_full = service_by(c, ho, "Grooming", grooming_type="Full")
    groom_basic = service_by(c, ho, "Grooming", grooming_type="Basic")
    lodge_std = service_by(c, ho, "Lodging", room_type="Standard")

    def deposit(bid):
        c.post(f"{BASE}/bookings/{bid}/deposit", headers=ho, json={"paymentMethod": "Online"})

    def checkin(bid, chip):
        return c.post(f"{BASE}/checkin", headers=hf, json={"bookingId": bid, "chipId": chip})

    # ---- B1: 咪咪 美容 full flow → Completed (+ photo) ----
    try:
        b1 = create_booking(c, ho, groom_full["id"], cat["id"],
                            now - timedelta(days=2, hours=4), now - timedelta(days=2, hours=2)).json()
        deposit(b1["id"])
        checkin(b1["id"], MARKER_CHIP)
        wos = c.get(f"{BASE}/grooming/work-orders", headers=hg).json()
        items = c.get(f"{BASE}/bookings/{b1['id']}", headers=ho).json()["items"]
        item_ids = {it["id"] for it in items}
        wo = next(w for w in wos if w["bookingItemId"] in item_ids)
        c.post(f"{BASE}/grooming/work-orders/{wo['id']}/start", headers=hg)
        for st in ("Bathing", "Drying", "Grooming"):
            c.post(f"{BASE}/grooming/work-orders/{wo['id']}/stage", headers=hg, json={"stage": st})
        # mock work photo
        c.post(f"{BASE}/grooming/work-orders/{wo['id']}/photos", headers=hg,
               files={"file": ("groom.png", io.BytesIO(_PNG), "image/png")})
        c.post(f"{BASE}/grooming/work-orders/{wo['id']}/complete", headers=hg)
        print("B1 咪咪 美容 → Completed (+照片)")
    except Exception as e:
        print("B1 failed:", e)

    # ---- B2: 汪汪 住宿 → CheckedIn (佔床) ----
    try:
        b2 = create_booking(c, ho, lodge_std["id"], dog["id"],
                            now - timedelta(hours=3), now + timedelta(days=2), qty=2).json()
        deposit(b2["id"])
        checkin(b2["id"], "CHIP-DOG-002")
        print("B2 汪汪 住宿 → CheckedIn (床位 Occupied)")
    except Exception as e:
        print("B2 failed:", e)

    # ---- B3: 咪咪 美容 → Confirmed (待報到，供 live demo) ----
    try:
        b3 = create_booking(c, ho, groom_basic["id"], cat["id"],
                            now + timedelta(days=1, hours=2), now + timedelta(days=1, hours=4)).json()
        deposit(b3["id"])
        print("B3 咪咪 美容 → Confirmed (待報到)")
    except Exception as e:
        print("B3 failed:", e)

    # ---- B4: 汪汪 美容 → PendingDeposit (待付訂金) ----
    try:
        create_booking(c, ho, groom_full["id"], dog["id"],
                       now + timedelta(days=3), now + timedelta(days=3, hours=2))
        print("B4 汪汪 美容 → PendingDeposit")
    except Exception as e:
        print("B4 failed:", e)

    # ---- B5: 虎虎(中度) → PendingReview (待審核) ----
    try:
        c.post(f"{BASE}/pets/{tiger['id']}/danger-level", headers=hf,
               json={"dangerLevel": "Medium", "dangerNote": "曾對陌生人低吼"})
        b5 = create_booking(c, ho, groom_basic["id"], tiger["id"],
                           now + timedelta(days=4), now + timedelta(days=4, hours=2)).json()
        print(f"B5 虎虎 美容 → {b5.get('status')} (中度待審核)")
    except Exception as e:
        print("B5 failed:", e)

    print("\ndemo data complete.")


if __name__ == "__main__":
    main()
