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


def test_expiry_rescue_engine_and_rampura_scenario():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_rampura = Facility(name="PHC Rampura", district_id=district.id, facility_type="PHC")
    fac_bavla = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC")
    db.add_all([fac_rampura, fac_bavla])
    db.flush()

    med_insulin = Medicine(name="Insulin 100IU", generic_name="Insulin", category="Endocrine", unit="vials")
    med_amox = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="tablets")
    db.add_all([med_insulin, med_amox])
    db.flush()

    today = date.today()

    # Scenario B: PHC Rampura has 500 vials of Insulin expiring in 45 days, but consumes only 1 vial/day
    # => Expected local consumption before expiry = 45 vials
    # => Rescueable surplus = 455 vials (Candidate for Expiry Rescue!)
    consumptions = []
    for offset in range(30, 0, -1):
        consumptions.append(
            ConsumptionRecord(
                facility_id=fac_rampura.id,
                medicine_id=med_insulin.id,
                date=today - timedelta(days=offset),
                quantity_consumed=1,
                patient_count=2,
            )
        )

    batch_rampura_insulin = InventoryBatch(
        facility_id=fac_rampura.id,
        medicine_id=med_insulin.id,
        batch_number="BAT-RAMPURA-INSULIN-EXCESS",
        quantity=500,
        expiry_date=today + timedelta(days=45),
    )

    # CHC Bavla has normal stock of Amoxicillin (300 units expiring in 180 days, consumes 10 units/day)
    for offset in range(30, 0, -1):
        consumptions.append(
            ConsumptionRecord(
                facility_id=fac_bavla.id,
                medicine_id=med_amox.id,
                date=today - timedelta(days=offset),
                quantity_consumed=10,
                patient_count=5,
            )
        )

    batch_bavla_amox = InventoryBatch(
        facility_id=fac_bavla.id,
        medicine_id=med_amox.id,
        batch_number="BAT-BAVLA-AMOX-NORMAL",
        quantity=300,
        expiry_date=today + timedelta(days=180),
    )

    admin_user = User(
        firebase_uid="mock-admin-expiry",
        name="Dr. Expiry Admin",
        email="expiry.admin@test.org",
        role="DISTRICT_ADMIN",
        district_id=district.id,
        status="ACTIVE",
    )

    db.add_all([admin_user, batch_rampura_insulin, batch_bavla_amox])
    db.add_all(consumptions)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. No-token request returns 401 Unauthorized
    res = client.get("/api/expiry/risks")
    assert res.status_code == 401

    # 2. District Admin fetches expiry risks
    res = client.get(
        "/api/expiry/risks",
        headers={"Authorization": "Bearer mock-admin-expiry"},
    )
    assert res.status_code == 200
    data = res.json()

    kpis = data["kpis"]
    assert kpis["total_batches_monitored"] >= 2
    assert kpis["total_rescueable_surplus_units"] >= 400

    # 3. Verify PHC Rampura Insulin appears as a rescue candidate
    rampura_item = next(
        (
            b
            for b in data["batch_risks"]
            if b["facility_name"] == "PHC Rampura" and b["medicine_name"] == "Insulin 100IU"
        ),
        None,
    )
    assert rampura_item is not None
    assert rampura_item["is_rescue_candidate"] is True
    assert rampura_item["potential_expiring_surplus"] >= 400
    assert rampura_item["urgency"] == "WARNING_60"
    assert "FEFO Rescue Candidate" in rampura_item["recommended_action"]

    # 4. Test GET /api/expiry/rescue-opportunities
    res_opps = client.get(
        "/api/expiry/rescue-opportunities",
        headers={"Authorization": "Bearer mock-admin-expiry"},
    )
    assert res_opps.status_code == 200
    opps = res_opps.json()
    assert len(opps) >= 1
    rampura_opp = next((o for o in opps if o["source_facility_name"] == "PHC Rampura"), None)
    assert rampura_opp is not None
    assert rampura_opp["rescueable_surplus"] >= 400
    assert rampura_opp["priority"] in ["HIGH", "MEDIUM"]
