"""
Phase 14 — Geographic Network Map Tests

Verifies:
  1. GET /api/map/facilities returns markers with lat/lng, risk color, and summary.
  2. All risk color values are valid.
  3. Transfer routes are included when pending transfers exist.
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
from app.models.core import (
    District, Facility, InventoryBatch, Medicine, StockTransfer, User
)

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)

VALID_COLORS = {"green", "yellow", "orange", "red", "purple"}


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_map_facilities_geo_risk():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_a = Facility(
        name="PHC Sanand", district_id=district.id, facility_type="PHC",
        status="ACTIVE", latitude=23.0315, longitude=72.3706,
    )
    fac_b = Facility(
        name="CHC Bavla", district_id=district.id, facility_type="CHC",
        status="ACTIVE", latitude=22.9510, longitude=72.3740,
    )
    db.add_all([fac_a, fac_b])
    db.flush()

    med = Medicine(name="ORS Powder", generic_name="ORS", category="Essential", unit="sachets")
    db.add(med)
    db.flush()

    today = date.today()

    # fac_a: very low stock — should be Critical/High Risk
    db.add(InventoryBatch(
        facility_id=fac_a.id, medicine_id=med.id, batch_number="ORS-LOW",
        quantity=5, expiry_date=today + timedelta(days=5),
    ))

    # fac_b: healthy surplus
    db.add(InventoryBatch(
        facility_id=fac_b.id, medicine_id=med.id, batch_number="ORS-SURP",
        quantity=900, expiry_date=today + timedelta(days=90),
    ))

    admin = User(
        firebase_uid="mock-map-user", name="Map Admin", email="map@test.org",
        role="DISTRICT_ADMIN", district_id=district.id, status="ACTIVE",
    )
    db.add(admin)

    # A pending transfer from fac_b to fac_a
    import random, string
    tracking = "TRK-MAP-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    transfer = StockTransfer(
        tracking_number=tracking,
        source_facility_id=fac_b.id,
        destination_facility_id=fac_a.id,
        medicine_id=med.id,
        quantity=100,
        status="PENDING",
    )
    db.add(transfer)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-map-user"}

    res = client.get("/api/map/facilities", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # Structure checks
    assert "markers" in data
    assert "transfer_routes" in data
    assert "summary" in data
    assert "district_center_lat" in data
    assert "district_center_lng" in data

    # Marker checks
    markers = data["markers"]
    assert len(markers) == 2

    for m in markers:
        assert "latitude" in m
        assert "longitude" in m
        assert m["risk_color"] in VALID_COLORS
        assert "risk_label" in m
        assert "total_stock_items" in m

    # fac_a should be higher risk than fac_b
    marker_a = next(m for m in markers if "Sanand" in m["name"])
    marker_b = next(m for m in markers if "Bavla" in m["name"])
    assert marker_a["risk_score"] >= marker_b["risk_score"]

    # Transfer routes
    routes = data["transfer_routes"]
    assert len(routes) >= 1
    route = routes[0]
    assert route["source_lat"] is not None
    assert route["destination_lat"] is not None
    assert route["quantity"] == 100

    # Summary keys present
    assert "green" in data["summary"]
    assert "red" in data["summary"] or "orange" in data["summary"]
