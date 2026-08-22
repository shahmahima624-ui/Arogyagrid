"""
Phase 11 — AI Supply Copilot Tests

Verifies natural-language queries:
  1. Intent classification & tool routing.
  2. Fact retrieval matching actual DB state.
  3. All 5 demo questions from Master Prompt:
     - "Which facilities are critical this week?"
     - "Which medicines are likely to expire?"
     - "What transfers should I approve today?"
     - "Can current district surplus solve all ORS shortages?"
     - "Which facility has the highest medicine risk?"
"""
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_copilot_natural_language_queries():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_sanand = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    fac_bavla = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC", status="ACTIVE")
    db.add_all([fac_sanand, fac_bavla])
    db.flush()

    med_ors = Medicine(name="ORS Powder", generic_name="Oral Rehydration Salts", category="Essential", unit="sachets")
    med_amox = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="capsules")
    db.add_all([med_ors, med_amox])
    db.flush()

    today = date.today()

    # PHC Sanand: critical ORS shortage (2 sachets left, 5/day demand)
    batch_ors_low = InventoryBatch(
        facility_id=fac_sanand.id, medicine_id=med_ors.id, batch_number="ORS-001",
        quantity=2, expiry_date=today + timedelta(days=90),
    )
    # CHC Bavla: ORS surplus (1000 sachets, 10/day demand)
    batch_ors_surplus = InventoryBatch(
        facility_id=fac_bavla.id, medicine_id=med_ors.id, batch_number="ORS-002",
        quantity=1000, expiry_date=today + timedelta(days=45),
    )

    consumptions = []
    for offset in range(30, 0, -1):
        consumptions.append(ConsumptionRecord(
            facility_id=fac_sanand.id, medicine_id=med_ors.id, date=today - timedelta(days=offset),
            quantity_consumed=5, patient_count=10,
        ))
        consumptions.append(ConsumptionRecord(
            facility_id=fac_bavla.id, medicine_id=med_ors.id, date=today - timedelta(days=offset),
            quantity_consumed=10, patient_count=20,
        ))

    admin = User(
        firebase_uid="mock-copilot-user", name="Dr. Copilot User", email="copilot.user@test.org",
        role="DISTRICT_ADMIN", district_id=district.id, status="ACTIVE",
    )

    db.add_all([batch_ors_low, batch_ors_surplus, admin])
    db.add_all(consumptions)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-copilot-user"}

    # Q1: "Which facilities are critical this week?"
    res1 = client.post("/api/ai/copilot", headers=headers, json={"query": "Which facilities are critical this week?"})
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["intent_detected"] == "CRITICAL_FACILITIES"
    assert "retrieved_facts" in d1

    # Q2: "Which medicines are likely to expire?"
    res2 = client.post("/api/ai/copilot", headers=headers, json={"query": "Which medicines are likely to expire?"})
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["intent_detected"] == "EXPIRING_MEDICINES"

    # Q3: "What transfers should I approve today?"
    res3 = client.post("/api/ai/copilot", headers=headers, json={"query": "What transfers should I approve today?"})
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["intent_detected"] == "PENDING_TRANSFERS"

    # Q4: "Can current district surplus solve all ORS shortages?"
    res4 = client.post("/api/ai/copilot", headers=headers, json={"query": "Can current district surplus solve all ORS shortages?"})
    assert res4.status_code == 200
    d4 = res4.json()
    assert d4["intent_detected"] == "MEDICINE_SURPLUS_SHORTAGE"
    assert d4["retrieved_facts"]["can_district_surplus_solve_shortage"] is True

    # Q5: "Which facility has the highest medicine risk?"
    res5 = client.post("/api/ai/copilot", headers=headers, json={"query": "Which facility has the highest medicine risk?"})
    assert res5.status_code == 200
    d5 = res5.json()
    assert d5["intent_detected"] == "FACILITY_RISK_RANKING"
