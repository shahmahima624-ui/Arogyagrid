import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date, timedelta

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import District, Facility, Medicine, InventoryBatch, StockTransfer, User, UserRole
from app.services import transfer_service

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def setup_security_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()
    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_a = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    fac_b = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC", status="ACTIVE")
    fac_c = Facility(name="District Hospital Viramgam", district_id=district.id, facility_type="DISTRICT_HOSPITAL", status="ACTIVE")
    db.add_all([fac_a, fac_b, fac_c])
    db.flush()

    med = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="capsules")
    db.add(med)
    db.flush()

    today = date.today()
    batch_a = InventoryBatch(facility_id=fac_a.id, medicine_id=med.id, batch_number="BAT-SAN-1", quantity=500, expiry_date=today + timedelta(days=120))
    batch_b = InventoryBatch(facility_id=fac_b.id, medicine_id=med.id, batch_number="BAT-BAV-1", quantity=300, expiry_date=today + timedelta(days=90))
    db.add_all([batch_a, batch_b])

    admin = User(firebase_uid="mock-district-admin", name="Admin User", email="admin@test.org", role=UserRole.DISTRICT_ADMIN.value, district_id=district.id, status="ACTIVE")
    staff_a = User(firebase_uid="mock-staff-sanand", name="Sanand Staff", email="staff.sanand@test.org", role=UserRole.HEALTHCARE_STAFF.value, facility_id=fac_a.id, district_id=district.id, status="ACTIVE")
    admin_sanand = User(firebase_uid="mock-facility-admin-sanand", name="Sanand Admin", email="admin.sanand@test.org", role=UserRole.FACILITY_ADMIN.value, facility_id=fac_a.id, district_id=district.id, status="ACTIVE")
    db.add_all([admin, staff_a, admin_sanand])
    db.commit()
    db.close()


def test_s1_no_token_returns_401():
    setup_security_db()
    client = TestClient(app)
    res = client.get("/api/inventory")
    assert res.status_code == 401
    assert "Authentication credentials" in res.json()["detail"] or "Authentication required" in res.json()["detail"]


def test_s2_malformed_token_returns_401():
    setup_security_db()
    client = TestClient(app)
    res = client.get("/api/inventory", headers={"Authorization": "Bearer malformed.invalid.token"})
    assert res.status_code == 401


def test_s3_wrong_role_triggers_403():
    setup_security_db()
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-staff-sanand"}
    res = client.post("/api/backup/create", headers=headers)
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_s4_facility_a_cannot_access_facility_b_transfer():
    setup_security_db()
    db = TestingSession()
    facilities = db.scalars(select(Facility)).all()
    med = db.scalar(select(Medicine))
    fac_b, fac_c = facilities[1], facilities[2]
    user_admin = db.scalar(select(User).where(User.role == UserRole.DISTRICT_ADMIN.value))

    transfer = transfer_service.create_manual_transfer(
        db=db,
        source_facility_id=fac_b.id,
        source_warehouse_id=None,
        destination_facility_id=fac_c.id,
        medicine_id=med.id,
        quantity=10,
        user=user_admin,
    )
    transfer_id = str(transfer.id)  # capture ID before closing session
    db.close()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-facility-admin-sanand"}
    res = client.get(f"/api/transfers/{transfer_id}", headers=headers)
    assert res.status_code == 403
    assert "Transfer does not involve your assigned facility" in res.json()["detail"]


def test_s5_staff_user_cannot_approve_transfer():
    setup_security_db()
    db = TestingSession()
    facilities = db.scalars(select(Facility)).all()
    med = db.scalar(select(Medicine))
    admin_user = db.scalar(select(User).where(User.role == UserRole.DISTRICT_ADMIN.value))

    transfer = transfer_service.create_manual_transfer(
        db=db,
        source_facility_id=facilities[0].id,
        source_warehouse_id=None,
        destination_facility_id=facilities[1].id,
        medicine_id=med.id,
        quantity=10,
        user=admin_user,
    )
    transfer_id = str(transfer.id)  # capture ID before closing session
    db.close()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-staff-sanand"}
    res = client.post(f"/api/transfers/{transfer_id}/approve", headers=headers)
    assert res.status_code == 403


def test_s6_duplicate_receive_returns_409_conflict():
    setup_security_db()
    db = TestingSession()
    facilities = db.scalars(select(Facility)).all()
    med = db.scalar(select(Medicine))
    admin_user = db.scalar(select(User).where(User.role == UserRole.DISTRICT_ADMIN.value))

    transfer = transfer_service.create_manual_transfer(
        db=db,
        source_facility_id=facilities[0].id,
        source_warehouse_id=None,
        destination_facility_id=facilities[1].id,
        medicine_id=med.id,
        quantity=50,
        user=admin_user,
    )
    transfer_service.approve_transfer(db, transfer.id, admin_user)
    transfer_service.dispatch_transfer(db, transfer.id, admin_user)
    transfer_id = str(transfer.id)  # capture ID before closing session
    db.close()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-district-admin"}
    res1 = client.post(f"/api/transfers/{transfer_id}/receive", headers=headers)
    assert res1.status_code == 200

    res2 = client.post(f"/api/transfers/{transfer_id}/receive", headers=headers)
    assert res2.status_code == 409
    assert "already been received" in res2.json()["detail"]


def test_s7_tracking_number_format():
    setup_security_db()
    db = TestingSession()
    admin_user = db.scalar(select(User).where(User.role == UserRole.DISTRICT_ADMIN.value))
    facilities = db.scalars(select(Facility)).all()
    med = db.scalar(select(Medicine))

    transfer = transfer_service.create_manual_transfer(
        db=db,
        source_facility_id=facilities[0].id,
        source_warehouse_id=None,
        destination_facility_id=facilities[1].id,
        medicine_id=med.id,
        quantity=5,
        user=admin_user,
    )
    tracking_number = transfer.tracking_number  # capture before closing session
    db.close()

    assert tracking_number.startswith("TRF-202")
    parts = tracking_number.split("-")
    assert len(parts) == 3
    assert len(parts[1]) == 8
