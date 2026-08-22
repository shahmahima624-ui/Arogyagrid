"""
Phase 20 & 21 — Cold-Chain Telemetry & SSE Real-Time Event Stream Tests

Verifies:
  1. POST /api/telemetry/log-temperature logs sensor readings and flags temperature excursions outside 2.0°C - 8.0°C.
  2. GET /api/events/stream returns Server-Sent Events stream.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import District, Facility

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_cold_chain_telemetry_and_events():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    db.add(fac)
    db.commit()

    client = TestClient(app)

    # 1. Normal temperature reading (4.5°C - within 2-8°C range)
    res_norm = client.post(
        "/api/telemetry/log-temperature",
        json={
            "facility_id": str(fac.id),
            "storage_unit_id": "FREEZER-01",
            "temperature_celsius": 4.5,
        },
    )
    assert res_norm.status_code == 200, res_norm.text
    norm_data = res_norm.json()
    assert norm_data["alert_level"] == "NORMAL"

    # 2. Critical temperature excursion reading (11.5°C - breach)
    res_crit = client.post(
        "/api/telemetry/log-temperature",
        json={
            "facility_id": str(fac.id),
            "storage_unit_id": "FREEZER-01",
            "temperature_celsius": 11.5,
        },
    )
    assert res_crit.status_code == 200, res_crit.text
    crit_data = res_crit.json()
    assert crit_data["alert_level"] == "EXCURSION_CRITICAL"
    assert "CRITICAL" in crit_data["message"]

    # 3. GET active alerts
    res_alerts = client.get("/api/telemetry/alerts")
    assert res_alerts.status_code == 200
    alerts_data = res_alerts.json()
    assert len(alerts_data) >= 1

    # 4. SSE Events stream check
    res_stream = client.get("/api/events/stream")
    assert res_stream.status_code == 200
    assert "text/event-stream" in res_stream.headers["content-type"]
