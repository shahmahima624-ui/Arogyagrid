import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.models.core import User, District, Facility, Medicine, InventoryBatch, ConsumptionRecord
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_stockout_risk_engine_and_scoping():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    facility1 = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC")
    facility2 = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC")
    db.add_all([facility1, facility2])
    db.flush()

    med1 = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="tablets")
    med2 = Medicine(name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesics", unit="tablets")
    db.add_all([med1, med2])
    db.flush()

    today = date.today()

    # Scenario: PHC Sanand has 100 units of Amoxicillin and consumes ~40 units/day => Stockout in ~2.5 days (CRITICAL)
    consumptions = []
    for offset in range(30, 0, -1):
        consumptions.append(
            ConsumptionRecord(
                facility_id=facility1.id,
                medicine_id=med1.id,
                date=today - timedelta(days=offset),
                quantity_consumed=40,
                patient_count=20,
            )
        )

    # Add 100 units of Amoxicillin at PHC Sanand
    db.add(
        InventoryBatch(
            facility_id=facility1.id,
            medicine_id=med1.id,
            batch_number="BAT-SANAND-CRIT",
            quantity=100,
            expiry_date=today + timedelta(days=180),
        )
    )

    # Scenario: CHC Bavla has 1000 units of Amoxicillin and consumes ~20 units/day => Stockout in 50 days (HEALTHY)
    for offset in range(30, 0, -1):
        consumptions.append(
            ConsumptionRecord(
                facility_id=facility2.id,
                medicine_id=med1.id,
                date=today - timedelta(days=offset),
                quantity_consumed=20,
                patient_count=10,
            )
        )

    db.add(
        InventoryBatch(
            facility_id=facility2.id,
            medicine_id=med1.id,
            batch_number="BAT-BAVLA-SURPLUS",
            quantity=1000,
            expiry_date=today + timedelta(days=240),
        )
    )

    # Seed users
    admin_user = User(
        firebase_uid="mock-district-admin",
        name="Dr. Amit Patel",
        email="district.admin@test.org",
        role="DISTRICT_ADMIN",
        district_id=district.id,
        status="ACTIVE",
    )
    sanand_user = User(
        firebase_uid="mock-facility-admin-sanand",
        name="Dr. Priya Shah",
        email="sanand.admin@test.org",
        role="FACILITY_ADMIN",
        facility_id=facility1.id,
        district_id=district.id,
        status="ACTIVE",
    )

    db.add_all([admin_user, sanand_user])
    db.add_all(consumptions)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. No-token request returns 401 Unauthorized
    res = client.get("/api/risks")
    assert res.status_code == 401

    # 2. District Admin gets risk assessment
    res = client.get(
        "/api/risks",
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res.status_code == 200
    data = res.json()

    kpis = data["kpis"]
    assert kpis["total_monitored_pairs"] >= 4
    assert kpis["critical_count"] >= 1

    # Find PHC Sanand + Amoxicillin
    sanand_amox = next(
        (
            r
            for r in data["risks"]
            if r["facility_name"] == "PHC Sanand" and r["medicine_name"] == "Amoxicillin 500mg"
        ),
        None,
    )
    assert sanand_amox is not None
    assert sanand_amox["risk_level"] == "CRITICAL"
    assert sanand_amox["days_to_stockout"] < 3.0
    assert "2 day" in sanand_amox["stockout_time_label"] or "day" in sanand_amox["stockout_time_label"]
    assert "transfer" in sanand_amox["recommended_action"].lower()

    # Find CHC Bavla + Amoxicillin
    bavla_amox = next(
        (
            r
            for r in data["risks"]
            if r["facility_name"] == "CHC Bavla" and r["medicine_name"] == "Amoxicillin 500mg"
        ),
        None,
    )
    assert bavla_amox is not None
    assert bavla_amox["risk_level"] == "HEALTHY"
    assert bavla_amox["days_to_stockout"] > 14.0

    # 3. Test Critical-only endpoint
    res_crit = client.get(
        "/api/risks/critical",
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res_crit.status_code == 200
    crit_list = res_crit.json()
    assert all(r["risk_level"] == "CRITICAL" for r in crit_list)

    # 4. Test Recalculate endpoint
    res_recalc = client.post(
        "/api/risks/recalculate",
        json={"critical_threshold_days": 4.0},
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res_recalc.status_code == 200
    recalc_data = res_recalc.json()
    assert recalc_data["status"] == "SUCCESS"
    assert recalc_data["recalculated_items_count"] >= 4

    # 5. Scoped Facility Admin view
    res_scoped = client.get(
        "/api/risks",
        headers={"Authorization": "Bearer mock-facility-admin-sanand"},
    )
    assert res_scoped.status_code == 200
    scoped_data = res_scoped.json()
    assert all(r["facility_name"] == "PHC Sanand" for r in scoped_data["risks"])
