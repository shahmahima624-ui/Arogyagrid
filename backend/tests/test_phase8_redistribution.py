"""
Phase 8 — Redistribution Engine Tests

Scenario:
  - PHC Sanand has critical insulin shortage (2 days to stockout)
  - CHC Bavla has a safe surplus of insulin
  - Engine should recommend CHC Bavla → PHC Sanand transfer
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
from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, User, Warehouse

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_redistribution_engine_demo_scenario():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    # Facilities with coordinates (Ahmedabad region)
    fac_sanand = Facility(
        name="PHC Sanand", district_id=district.id, facility_type="PHC",
        latitude=22.99, longitude=72.37, status="ACTIVE",
    )
    fac_bavla = Facility(
        name="CHC Bavla", district_id=district.id, facility_type="CHC",
        latitude=22.83, longitude=72.37, status="ACTIVE",
    )
    wh_central = Warehouse(
        name="Central Warehouse", district_id=district.id,
        latitude=23.03, longitude=72.58,
    )
    db.add_all([fac_sanand, fac_bavla, wh_central])
    db.flush()

    med_insulin = Medicine(name="Insulin 100IU/ml", generic_name="Insulin", category="Endocrine", unit="vials")
    db.add(med_insulin)
    db.flush()

    today = date.today()

    # PHC Sanand: ONLY 4 vials left, consumes 2/day → ~2 days to stockout
    batch_sanand_low = InventoryBatch(
        facility_id=fac_sanand.id, medicine_id=med_insulin.id,
        batch_number="SNM-001", quantity=4,
        expiry_date=today + timedelta(days=180),
    )

    # CHC Bavla: 500 vials, consumes 5/day → large safe surplus
    batch_bavla_surplus = InventoryBatch(
        facility_id=fac_bavla.id, medicine_id=med_insulin.id,
        batch_number="BVL-001", quantity=500,
        expiry_date=today + timedelta(days=120),
    )

    # Central warehouse: 1000 vials as fallback
    batch_wh = InventoryBatch(
        warehouse_id=wh_central.id, medicine_id=med_insulin.id,
        batch_number="WH-001", quantity=1000,
        expiry_date=today + timedelta(days=200),
    )

    # Consumption records
    consumptions = []
    for offset in range(30, 0, -1):
        consumptions.append(ConsumptionRecord(
            facility_id=fac_sanand.id, medicine_id=med_insulin.id,
            date=today - timedelta(days=offset), quantity_consumed=2, patient_count=5,
        ))
        consumptions.append(ConsumptionRecord(
            facility_id=fac_bavla.id, medicine_id=med_insulin.id,
            date=today - timedelta(days=offset), quantity_consumed=5, patient_count=12,
        ))

    admin = User(
        firebase_uid="mock-admin-redist",
        name="District Admin Redistribution",
        email="redistrib.admin@test.org",
        role="DISTRICT_ADMIN",
        district_id=district.id,
        status="ACTIVE",
    )

    db.add_all([batch_sanand_low, batch_bavla_surplus, batch_wh, admin])
    db.add_all(consumptions)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. Unauthenticated request blocked
    res = client.post("/api/redistribution/generate", json={})
    assert res.status_code == 401

    # 2. Generate recommendations
    res = client.post(
        "/api/redistribution/generate",
        headers={"Authorization": "Bearer mock-admin-redist"},
        json={"top_n_per_shortage": 3},
    )
    assert res.status_code == 200
    gen = res.json()
    assert gen["scenarios_evaluated"] >= 1
    assert gen["recommendations_created"] >= 1

    # 3. List recommendations — PHC Sanand insulin shortage should be addressed
    res = client.get(
        "/api/redistribution/recommendations",
        headers={"Authorization": "Bearer mock-admin-redist"},
    )
    assert res.status_code == 200
    recs = res.json()
    assert len(recs) >= 1

    # The top recommendation should be for PHC Sanand (critical shortage)
    sanand_rec = next(
        (r for r in recs if r["destination_facility_name"] == "PHC Sanand"),
        None,
    )
    assert sanand_rec is not None, "Expected recommendation for PHC Sanand"
    assert sanand_rec["recommended_quantity"] > 0
    assert sanand_rec["status"] == "RECOMMENDED"
    assert sanand_rec["confidence"] > 0.0
    assert "score_breakdown" in sanand_rec

    # Score breakdown should be present with all fields
    bd = sanand_rec["score_breakdown"]
    assert "urgency_weight" in bd
    assert "surplus_weight" in bd
    assert "distance_penalty" in bd
    assert "final_score" in bd

    # 4. Get single recommendation by ID
    rec_id = sanand_rec["id"]
    res = client.get(
        f"/api/redistribution/{rec_id}",
        headers={"Authorization": "Bearer mock-admin-redist"},
    )
    assert res.status_code == 200
    detail = res.json()
    assert detail["id"] == rec_id
    assert detail["destination_facility_name"] == "PHC Sanand"
