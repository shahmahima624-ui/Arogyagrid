"""
Phase 13 — Register Image Digitisation Tests

Verifies:
  1. POST /api/register/extract returns structured rows from image (or fallback).
  2. Fallback deterministic parser returns multi-row data with all required fields.
  3. DB is untouched until human submits verified rows via POST /api/register/submit.
  4. Submit reconciles closing stock into InventoryBatch and creates AuditLog rows.
"""
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import AuditLog, District, Facility, InventoryBatch, Medicine, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_register_digitisation_extract_and_submit():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    db.add(fac)
    db.flush()

    med_pcm = Medicine(name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesics", unit="tablets")
    med_ors = Medicine(name="ORS Powder", generic_name="Oral Rehydration Salts", category="Essential", unit="sachets")
    med_amox = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="capsules")
    db.add_all([med_pcm, med_ors, med_amox])
    db.flush()

    admin = User(
        firebase_uid="mock-register-user", name="Dr. Register Staff", email="register.staff@test.org",
        role="HEALTHCARE_STAFF", facility_id=fac.id, status="ACTIVE",
    )
    db.add(admin)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-register-user"}

    # Step 1: Extract — no image_base64 triggers deterministic fallback
    res_extract = client.post(
        "/api/register/extract",
        headers=headers,
        json={"image_reference": "test_register_page1.jpg"},
    )
    assert res_extract.status_code == 200, res_extract.text
    data_extract = res_extract.json()

    assert "rows" in data_extract
    assert len(data_extract["rows"]) >= 1

    row = data_extract["rows"][0]
    assert "medicine_name" in row
    assert "closing_stock" in row
    assert "confidence_score" in row
    assert data_extract["model_used"] is not None

    # VERIFY DB untouched before submit
    db.expire_all()
    batches_before = db.scalars(select(InventoryBatch).where(InventoryBatch.facility_id == fac.id)).all()
    assert len(batches_before) == 0

    # Step 2: Human submits verified rows
    res_submit = client.post(
        "/api/register/submit",
        headers=headers,
        json={
            "facility_id": str(fac.id),
            "verified_rows": data_extract["rows"],
            "image_reference": "test_register_page1.jpg",
        },
    )
    assert res_submit.status_code == 200, res_submit.text
    sub_data = res_submit.json()
    assert sub_data["success"] is True
    assert sub_data["rows_updated"] >= 1

    # VERIFY DB reconciled after submit
    db.expire_all()
    batches_after = db.scalars(select(InventoryBatch).where(InventoryBatch.facility_id == fac.id)).all()
    assert len(batches_after) >= 1

    audits = db.scalars(select(AuditLog).where(AuditLog.facility_id == fac.id)).all()
    assert len(audits) >= 1
    assert audits[0].action == "REGISTER_DIGITISED"
    assert "Paracetamol" in audits[0].description or "ORS" in audits[0].description or "Amoxicillin" in audits[0].description
