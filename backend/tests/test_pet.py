"""Pet & Health integration — CRUD, medical records, vaccinations, proof, ownership."""
from __future__ import annotations


def _owner(make_account, auth_headers, email=None):
    acc = make_account(role="Owner", email=email)
    return acc, auth_headers(acc)


def _create_pet(client, headers, name="旺財"):
    r = client.post("/api/v1/pets",
                    json={"name": name, "species": "Dog", "breed": "柴犬", "behaviorNote": "怕生"},
                    headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_pet_crud(client, make_account, auth_headers):
    owner, h = _owner(make_account, auth_headers)
    pet = _create_pet(client, h)
    assert pet["name"] == "旺財"
    assert pet["dangerLevel"] == "None"
    assert pet["isBlocked"] is False
    assert pet["ownerId"] == str(owner.id)
    pet_id = pet["id"]

    listing = client.get("/api/v1/pets", headers=h)
    assert listing.status_code == 200 and len(listing.json()) == 1

    got = client.get(f"/api/v1/pets/{pet_id}", headers=h)
    assert got.status_code == 200 and got.json()["id"] == pet_id

    patched = client.patch(f"/api/v1/pets/{pet_id}",
                           json={"name": "小白", "behaviorNote": "不喜歡被碰腳"}, headers=h)
    assert patched.status_code == 200
    assert patched.json()["name"] == "小白"
    assert patched.json()["behaviorNote"] == "不喜歡被碰腳"


def test_medical_records_append_and_list(client, make_account, auth_headers):
    owner, h = _owner(make_account, auth_headers)
    pet_id = _create_pet(client, h)["id"]
    r = client.post(f"/api/v1/pets/{pet_id}/medical-records",
                    json={"description": "2025 年曾因皮膚過敏就診"}, headers=h)
    assert r.status_code == 201
    assert r.json()["description"] == "2025 年曾因皮膚過敏就診"
    listing = client.get(f"/api/v1/pets/{pet_id}/medical-records", headers=h)
    assert listing.status_code == 200 and len(listing.json()) == 1


def test_vaccination_and_proof_upload(client, make_account, auth_headers, monkeypatch, tmp_path):
    from app.core.config import settings
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    owner, h = _owner(make_account, auth_headers)
    pet_id = _create_pet(client, h)["id"]

    r = client.post(f"/api/v1/pets/{pet_id}/vaccinations",
                    json={"vaccineName": "狂犬病疫苗", "expiresAt": "2027-12-31"}, headers=h)
    assert r.status_code == 201
    assert r.json()["status"] == "Pending"
    vid = r.json()["id"]

    assert len(client.get(f"/api/v1/pets/{pet_id}/vaccinations", headers=h).json()) == 1

    r = client.post(f"/api/v1/pets/{pet_id}/vaccinations/{vid}/proof",
                    files={"file": ("proof.pdf", b"%PDF-1.4 fake", "application/pdf")}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["fileUrl"].endswith(".pdf")
    assert (tmp_path / "vaccine_proofs" / f"{vid}.pdf").exists()

    # re-upload rejected — proof is append-only (FR-02.4 red line)
    r = client.post(f"/api/v1/pets/{pet_id}/vaccinations/{vid}/proof",
                    files={"file": ("proof2.pdf", b"%PDF-1.4 other", "application/pdf")}, headers=h)
    assert r.status_code == 409


def test_proof_rejects_unsupported_type(client, make_account, auth_headers, monkeypatch, tmp_path):
    from app.core.config import settings
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner, h = _owner(make_account, auth_headers)
    pet_id = _create_pet(client, h)["id"]
    vid = client.post(f"/api/v1/pets/{pet_id}/vaccinations",
                      json={"vaccineName": "X"}, headers=h).json()["id"]
    r = client.post(f"/api/v1/pets/{pet_id}/vaccinations/{vid}/proof",
                    files={"file": ("note.txt", b"hello", "text/plain")}, headers=h)
    assert r.status_code == 415


def test_owner_cannot_access_another_owners_pet(client, make_account, auth_headers):
    o1, h1 = _owner(make_account, auth_headers, email="o1@example.com")
    o2, h2 = _owner(make_account, auth_headers, email="o2@example.com")
    pet_id = _create_pet(client, h1)["id"]

    assert client.get(f"/api/v1/pets/{pet_id}", headers=h2).status_code == 404
    assert client.patch(f"/api/v1/pets/{pet_id}", json={"name": "x"}, headers=h2).status_code == 404
    assert client.post(f"/api/v1/pets/{pet_id}/medical-records",
                       json={"description": "x"}, headers=h2).status_code == 404


def test_staff_can_read_any_pet_but_not_create(client, make_account, auth_headers):
    owner, oh = _owner(make_account, auth_headers)
    pet_id = _create_pet(client, oh)["id"]

    fd = make_account(role="FrontDesk")
    fh = auth_headers(fd)
    # staff may read any pet + its records
    assert client.get(f"/api/v1/pets/{pet_id}", headers=fh).status_code == 200
    assert client.get(f"/api/v1/pets/{pet_id}/medical-records", headers=fh).status_code == 200
    # but creating a pet is Owner-only
    assert client.post("/api/v1/pets", json={"name": "x"}, headers=fh).status_code == 403
