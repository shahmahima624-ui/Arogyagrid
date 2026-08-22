"""
Phase 12 — Voice Inventory Reporting Tests

Verifies:
  1. Hinglish/English voice transcript parsing into structured drafts.
  2. Human verification workflow: unverified voice draft does NOT auto-save.
  3. POST /api/voice/submit-report reconciles verified items to DB inventory and consumption records.
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
from app.models.core import AuditLog, ConsumptionRecord, District, Facility, InventoryBatch, Medicine, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_voice_inventory_extraction_and_verification_submit():
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

    med = Medicine(name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesics", unit="tablets")
    db.add(med)
    db.flush()

    admin = User(
        firebase_uid="mock-voice-user", name="Dr. Voice Staff", email="voice.staff@test.org",
        role="HEALTHCARE_STAFF", facility_id=fac.id, status="ACTIVE",
    )
    db.add(admin)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-voice-user"}

    # 1. Process Hinglish transcript: "Paracetamol 500mg ke 240 tablets bache hain. Aaj 37 use hue."
    transcript_text = "Paracetamol 500mg ke 240 tablets bache hain. Aaj 37 use hue."
    res_proc = client.post(
        "/api/voice/process-transcript",
        headers=headers,
        json={"transcript": transcript_text, "facility_id": str(fac.id)},
    )
    assert res_proc.status_code == 200, res_proc.text
    data_proc = res_proc.json()
    assert len(data_proc["drafts"]) >= 1

    draft = data_proc["drafts"][0]
    assert draft["remaining_stock"] == 240
    assert draft["consumed_today"] == 37

    # VERIFY DB INVENTORY IS UNTOUCHED BEFORE HUMAN SUBMIT
    db.expire_all()
    batches = db.scalars(select(InventoryBatch).where(InventoryBatch.facility_id == fac.id)).all()
    assert len(batches) == 0

    # 2. Human Verification & Submit
    res_sub = client.post(
        "/api/voice/submit-report",
        headers=headers,
        json={
            "facility_id": str(fac.id),
            "verified_items": [draft],
        },
    )
    assert res_sub.status_code == 200, res_sub.text
    sub_data = res_sub.json()
    assert sub_data["success"] is True
    assert sub_data["items_updated"] >= 1

    # VERIFY DB INVENTORY RECONCILED AFTER HUMAN SUBMIT
    db.expire_all()
    batches_after = db.scalars(select(InventoryBatch).where(InventoryBatch.facility_id == fac.id)).all()
    assert len(batches_after) == 1
    assert batches_after[0].quantity == 240

    records_after = db.scalars(select(ConsumptionRecord).where(ConsumptionRecord.facility_id == fac.id)).all()
    assert len(records_after) == 1
    assert records_after[0].quantity_consumed == 37

    audits = db.scalars(select(AuditLog).where(AuditLog.facility_id == fac.id)).all()
    assert len(audits) >= 1
    assert audits[0].action == "VOICE_REPORT_SUBMITTED"
