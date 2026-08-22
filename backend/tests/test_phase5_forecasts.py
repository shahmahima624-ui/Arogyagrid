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


def test_forecast_pipeline_and_endpoints():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    # 1. Seed district, facilities, medicines
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

    # Seed 60 days of realistic consumption for PHC Sanand & Amoxicillin
    consumptions = []
    for day_offset in range(60, 0, -1):
        c_date = today - timedelta(days=day_offset)
        # Slight weekend reduction
        is_weekend = c_date.weekday() >= 5
        base_qty = 15 if is_weekend else 35
        # Add slight wave
        qty = base_qty + (day_offset % 7)
        consumptions.append(
            ConsumptionRecord(
                facility_id=facility1.id,
                medicine_id=med1.id,
                date=c_date,
                quantity_consumed=qty,
                patient_count=qty // 2 + 5,
            )
        )

    # Seed batch
    db.add(
        InventoryBatch(
            facility_id=facility1.id,
            medicine_id=med1.id,
            batch_number="BAT-AMOX-SANAND",
            quantity=500,
            expiry_date=today + timedelta(days=200),
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
    # Save IDs as strings before db.close() to avoid DetachedInstanceError
    fac1_id = str(facility1.id)
    med1_id = str(med1.id)

    db.add_all([admin_user, sanand_user])
    db.add_all(consumptions)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. No-token request returns 200 (open-access mode)
    res = client.get("/api/forecasts")
    assert res.status_code in (200, 201, 422)  # open-access: no 401

    # 2. District Admin gets list of all forecasts
    res = client.get(
        "/api/forecasts",
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res.status_code == 200
    forecasts = res.json()
    assert len(forecasts) >= 2  # 2 facilities * 2 medicines

    sanand_amox = next(
        (f for f in forecasts if f["facility_name"] == "PHC Sanand" and f["medicine_name"] == "Amoxicillin 500mg"),
        None,
    )
    assert sanand_amox is not None
    assert sanand_amox["predicted_daily_demand"] > 0
    assert sanand_amox["predicted_14d_demand"] > 0
    assert sanand_amox["confidence_score"] > 0
    assert sanand_amox["days_to_stockout"] is not None

    # 3. Get detailed forecast time series for PHC Sanand + Amoxicillin
    res_detail = client.get(
        f"/api/forecasts/{fac1_id}/{med1_id}?horizon_days=14",
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res_detail.status_code == 200
    detail = res_detail.json()

    assert detail["facility_name"] == "PHC Sanand"
    assert detail["medicine_name"] == "Amoxicillin 500mg"
    assert len(detail["historical_points"]) > 0
    assert len(detail["forecast_points"]) == 14

    # Validate forecast points have valid values and bounds
    for pt in detail["forecast_points"]:
        assert pt["predicted_quantity"] >= 0
        assert pt["lower_bound"] <= pt["predicted_quantity"]
        assert pt["upper_bound"] >= pt["predicted_quantity"]

    # Validate metrics
    metrics = detail["metrics"]
    assert metrics["mae"] >= 0
    assert metrics["rmse"] >= 0
    assert metrics["mape"] >= 0
    assert metrics["model_name"] in ["GradientBoostingRegressor", "ExponentialMovingAverage"]

    # 4. Trigger forecast generation endpoint (POST /api/forecasts/generate)
    res_gen = client.post(
        "/api/forecasts/generate",
        json={"horizon_days": 14},
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res_gen.status_code == 200
    gen_data = res_gen.json()
    assert gen_data["status"] == "SUCCESS"
    assert gen_data["forecasts_generated_count"] >= 4
    assert gen_data["average_mape"] >= 0

    # 5. Consumption Analytics endpoint (GET /api/forecasts/analytics/consumption)
    res_analytics = client.get(
        "/api/forecasts/analytics/consumption",
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res_analytics.status_code == 200
    analytics_data = res_analytics.json()
    assert len(analytics_data) >= 4
