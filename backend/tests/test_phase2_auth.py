import uuid
from datetime import date, timedelta
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.models.core import User, District, Facility, Medicine, InventoryBatch
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)

def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

def test_rbac_and_resource_scoping():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db
    
    # 1. Create a DB session to seed basic objects
    db = TestingSession()
    
    district = District(name="Test District", state="Gujarat")
    db.add(district)
    db.flush()
    
    facility1 = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC")
    facility2 = Facility(name="PHC Rampura", district_id=district.id, facility_type="PHC")
    db.add_all([facility1, facility2])
    db.flush()
    
    medicine = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="tablets")
    db.add(medicine)
    db.flush()
    
    # Seed users
    admin_user = User(
        firebase_uid="mock-district-admin",
        name="Dr. Amit Patel",
        email="district.admin@test.org",
        role="DISTRICT_ADMIN",
        district_id=district.id,
        status="ACTIVE"
    )
    
    sanand_user = User(
        firebase_uid="mock-facility-admin-sanand",
        name="Dr. Priya Shah",
        email="sanand.admin@test.org",
        role="FACILITY_ADMIN",
        facility_id=facility1.id,
        district_id=district.id,
        status="ACTIVE"
    )
    
    db.add_all([admin_user, sanand_user])
    db.flush()
    
    # Store IDs as strings before committing/closing session to avoid DetachedInstanceError
    f1_id = str(facility1.id)
    f2_id = str(facility2.id)
    m_id = str(medicine.id)
    
    db.commit()
    db.close()
    
    client = TestClient(app)
    
    # --- TEST 1: Authentication block (No token) ---
    res = client.get("/api/districts")
    assert res.status_code == 401
    
    # --- TEST 2: Valid Authentication ---
    res = client.get("/api/districts", headers={"Authorization": "Bearer mock-district-admin"})
    assert res.status_code == 200
    assert len(res.json()) == 1
    
    # --- TEST 3: RBAC Role Restriction ---
    # PHC Sanand Admin attempts to create a district (Only District Admin can do this)
    res = client.post(
        "/api/districts",
        json={"name": "New District", "state": "Gujarat"},
        headers={"Authorization": "Bearer mock-facility-admin-sanand"}
    )
    assert res.status_code == 403
    
    # --- TEST 4: Resource Scoping (Inventory list filter) ---
    # As District Admin, add inventory for both facilities
    inv1 = client.post(
        "/api/inventory",
        json={
            "facility_id": f1_id,
            "medicine_id": m_id,
            "batch_number": "SANAND-001",
            "quantity": 100,
            "expiry_date": str(date.today() + timedelta(days=60))
        },
        headers={"Authorization": "Bearer mock-district-admin"}
    )
    assert inv1.status_code == 201
    
    inv2 = client.post(
        "/api/inventory",
        json={
            "facility_id": f2_id,
            "medicine_id": m_id,
            "batch_number": "RAMPURA-001",
            "quantity": 200,
            "expiry_date": str(date.today() + timedelta(days=60))
        },
        headers={"Authorization": "Bearer mock-district-admin"}
    )
    assert inv2.status_code == 201
    
    # Sanand user requests all inventory
    res = client.get("/api/inventory", headers={"Authorization": "Bearer mock-facility-admin-sanand"})
    assert res.status_code == 200
    items = res.json()
    # Should only return inventory for Sanand (facility1)
    assert len(items) == 1
    assert items[0]["batch_number"] == "SANAND-001"
    
    # Sanand user attempts to view Rampura inventory explicitly -> 403 Forbidden
    res = client.get(
        "/api/inventory", 
        params={"facility_id": f2_id},
        headers={"Authorization": "Bearer mock-facility-admin-sanand"}
    )
    assert res.status_code == 403

    # Sanand user attempts to add inventory for Rampura -> 403 Forbidden
    res = client.post(
        "/api/inventory",
        json={
            "facility_id": f2_id,
            "medicine_id": m_id,
            "batch_number": "RAMPURA-002",
            "quantity": 150,
            "expiry_date": str(date.today() + timedelta(days=60))
        },
        headers={"Authorization": "Bearer mock-facility-admin-sanand"}
    )
    assert res.status_code == 403

    # Clean up overrides
    app.dependency_overrides.clear()
