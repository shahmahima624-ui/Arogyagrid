import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.models.core import User, District, Facility, Medicine, InventoryBatch, AuditLog, ConsumptionRecord
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_command_center_endpoint():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    # 1. Seed district, facilities, medicines, and inventory
    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    facility1 = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC")
    facility2 = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC")
    db.add_all([facility1, facility2])
    db.flush()

    med1 = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="tablets")
    med2 = Medicine(name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesics", unit="tablets")
    med3 = Medicine(name="ORS Sachet", generic_name="Oral Rehydration Salts", category="Emergency", unit="sachets")
    db.add_all([med1, med2, med3])
    db.flush()

    today = date.today()

    # Batch 1: Expiring in 15 days (CRITICAL_30), low stock
    b1 = InventoryBatch(
        facility_id=facility1.id,
        medicine_id=med1.id,
        batch_number="BAT-AMOX-01",
        quantity=50,  # low stock < 150
        expiry_date=today + timedelta(days=15),
    )
    # Batch 2: Adequate stock, normal expiry
    b2 = InventoryBatch(
        facility_id=facility2.id,
        medicine_id=med1.id,
        batch_number="BAT-AMOX-02",
        quantity=800,
        expiry_date=today + timedelta(days=300),
    )
    # Batch 3: Expiring in 45 days (WARNING_60)
    b3 = InventoryBatch(
        facility_id=facility1.id,
        medicine_id=med2.id,
        batch_number="BAT-PARA-01",
        quantity=120,  # low stock < 150
        expiry_date=today + timedelta(days=45),
    )
    db.add_all([b1, b2, b3])
    db.flush()

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
    db.flush()

    # Seed Audit Log
    audit = AuditLog(
        user_id=admin_user.id,
        facility_id=facility1.id,
        action="UPDATE",
        entity="INVENTORY",
        entity_id=b1.id,
        description="Updated batch quantity for BAT-AMOX-01",
    )
    db.add(audit)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. No-token request returns 401 Unauthorized
    res = client.get("/api/dashboard/command-center")
    assert res.status_code == 401

    # 2. District Admin gets overall district metrics
    res = client.get(
        "/api/dashboard/command-center",
        headers={"Authorization": "Bearer mock-district-admin"},
    )
    assert res.status_code == 200
    data = res.json()

    # Verify KPIs
    kpis = data["kpis"]
    assert kpis["total_facilities"] == 2
    assert kpis["total_medicines"] == 3
    assert kpis["total_inventory_units"] == 50 + 800 + 120
    assert kpis["expiring_soon_count"] == 2  # b1 (15 days) and b3 (45 days)
    assert kpis["low_stock_items_count"] > 0

    # Verify Facility Health
    health = data["facility_health"]
    assert len(health) == 2
    facility_names = [f["name"] for f in health]
    assert "PHC Sanand" in facility_names
    assert "CHC Bavla" in facility_names

    # Verify Expiry Alerts
    expiry_alerts = data["expiry_alerts"]
    assert len(expiry_alerts) == 2
    assert expiry_alerts[0]["batch_number"] == "BAT-AMOX-01"
    assert expiry_alerts[0]["urgency"] == "CRITICAL_30"
    assert expiry_alerts[1]["batch_number"] == "BAT-PARA-01"
    assert expiry_alerts[1]["urgency"] == "WARNING_60"

    # Verify Category Distribution
    categories = {c["category"]: c["total_units"] for c in data["category_distribution"]}
    assert categories["Antibiotics"] == 850
    assert categories["Analgesics"] == 120

    # Verify Activity Feed
    activity = data["recent_activity"]
    assert len(activity) >= 1
    assert "BAT-AMOX-01" in activity[0]["description"]

    # 3. Scoped Facility Admin view
    res_fac = client.get(
        "/api/dashboard/command-center",
        headers={"Authorization": "Bearer mock-facility-admin-sanand"},
    )
    assert res_fac.status_code == 200
    data_fac = res_fac.json()
    assert data_fac["kpis"]["total_facilities"] == 1
    assert len(data_fac["facility_health"]) == 1
    assert data_fac["facility_health"][0]["name"] == "PHC Sanand"
