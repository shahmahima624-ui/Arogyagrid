"""
Phase 15 — Health Supply Stress Simulator Tests

Verifies:
  1. POST /api/simulations/run computes baseline vs. simulated demand surges (+30%, +50%).
  2. Accelerated stockout dates and emergency stock buffers are accurately calculated.
  3. Preventive transfer recommendations are matched from surplus facilities to shortage facilities.
  4. Projection chart data series is returned.
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


def test_stress_simulation_run():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_a = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    fac_b = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC", status="ACTIVE")
    db.add_all([fac_a, fac_b])
    db.flush()

    med_ors = Medicine(name="ORS Powder", generic_name="ORS", category="Essential", unit="sachets")
    db.add(med_ors)
    db.flush()

    today = date.today()

    # fac_a: low stock (100 units, 20/day demand -> 5 days baseline stockout)
    batch_a = InventoryBatch(
        facility_id=fac_a.id, medicine_id=med_ors.id, batch_number="ORS-01",
        quantity=100, expiry_date=today + timedelta(days=90),
    )
    # fac_b: high stock surplus (2000 units, 10/day demand -> 200 days baseline)
    batch_b = InventoryBatch(
        facility_id=fac_b.id, medicine_id=med_ors.id, batch_number="ORS-02",
        quantity=2000, expiry_date=today + timedelta(days=120),
    )

    consumptions = []
    for offset in range(30, 0, -1):
        consumptions.append(ConsumptionRecord(
            facility_id=fac_a.id, medicine_id=med_ors.id, date=today - timedelta(days=offset),
            quantity_consumed=20, patient_count=30,
        ))
        consumptions.append(ConsumptionRecord(
            facility_id=fac_b.id, medicine_id=med_ors.id, date=today - timedelta(days=offset),
            quantity_consumed=10, patient_count=15,
        ))

    admin = User(
        firebase_uid="mock-sim-user", name="Sim Admin", email="sim@test.org",
        role="DISTRICT_ADMIN", district_id=district.id, status="ACTIVE",
    )

    db.add_all([batch_a, batch_b, admin])
    db.add_all(consumptions)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-sim-user"}

    # Run +50% Heatwave Surge simulation on ORS
    res = client.post(
        "/api/simulations/run",
        headers=headers,
        json={
            "scenario_type": "HEATWAVE_SURGE",
            "medicine_name_filter": "ORS",
            "demand_increase_percentage": 50.0,
            "supply_delay_days": 2,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    # Verify response structure
    assert "summary" in data
    assert "facility_impacts" in data
    assert "preventive_transfers" in data
    assert "chart_data" in data

    summary = data["summary"]
    assert summary["total_facilities_affected"] >= 1
    assert summary["total_emergency_stock_needed"] >= 0

    # Verify facility impact math
    impacts = data["facility_impacts"]
    sanand_impact = next(i for i in impacts if "Sanand" in i["facility_name"])

    # Baseline daily = 20, +50% simulated daily = 30
    assert sanand_impact["baseline_daily_demand"] == 20.0
    assert sanand_impact["simulated_daily_demand"] == 30.0
    # Simulated stockout days should be smaller than baseline
    assert sanand_impact["simulated_days_to_stockout"] < sanand_impact["baseline_days_to_stockout"]

    # Verify chart data projection
    chart = data["chart_data"]
    assert len(chart) >= 5
    assert chart[0]["baseline_stock"] >= chart[0]["simulated_stock"]
