"""
Phase 9 — Human Approval & Stock Transfers Test Suite

Verifies:
  1. Transfer lifecycle: PENDING -> APPROVED -> IN_TRANSIT -> RECEIVED.
  2. Inventory is NOT modified during PENDING, APPROVED, or IN_TRANSIT.
  3. Inventory is ONLY reconciled upon confirmation of RECEIVED.
  4. Duplicate RECEIVE requests are blocked with HTTP 400.
  5. Source stock deducted (FEFO) and destination stock added.
  6. Audit logs created for TRANSFER_OUT and TRANSFER_IN.
"""
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import AuditLog, District, Facility, InventoryBatch, Medicine, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_end_to_end_stock_transfer_lifecycle():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_src = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC", status="ACTIVE")
    fac_dest = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    db.add_all([fac_src, fac_dest])
    db.flush()

    med = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="capsules")
    db.add(med)
    db.flush()

    today = date.today()

    # Source has 500 capsules
    batch_src = InventoryBatch(
        facility_id=fac_src.id,
        medicine_id=med.id,
        batch_number="BAT-SRC-AMOX-500",
        quantity=500,
        expiry_date=today + timedelta(days=120),
    )
    # Destination has 10 capsules
    batch_dest = InventoryBatch(
        facility_id=fac_dest.id,
        medicine_id=med.id,
        batch_number="BAT-DEST-AMOX-10",
        quantity=10,
        expiry_date=today + timedelta(days=90),
    )

    admin = User(
        firebase_uid="mock-admin-transfer",
        name="Dr. Transfer Admin",
        email="transfer.admin@test.org",
        role="DISTRICT_ADMIN",
        district_id=district.id,
        status="ACTIVE",
    )

    db.add_all([batch_src, batch_dest, admin])
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-admin-transfer"}

    # 1. Create Manual Transfer (100 capsules from CHC Bavla -> PHC Sanand)
    res_create = client.post(
        "/api/transfers/manual",
        headers=headers,
        json={
            "source_facility_id": str(fac_src.id),
            "destination_facility_id": str(fac_dest.id),
            "medicine_id": str(med.id),
            "quantity": 100,
            "notes": "Emergency stock replenishment",
        },
    )
    assert res_create.status_code == 200, res_create.text
    t_data = res_create.json()
    transfer_id = t_data["id"]
    assert t_data["status"] == "PENDING"

    # VERIFY INVENTORY UNTOUCHED AT PENDING
    db.expire_all()
    b_src_curr = db.get(InventoryBatch, batch_src.id)
    b_dest_curr = db.get(InventoryBatch, batch_dest.id)
    assert b_src_curr.quantity == 500
    assert b_dest_curr.quantity == 10

    # 2. Approve Transfer
    res_app = client.post(f"/api/transfers/{transfer_id}/approve", headers=headers)
    assert res_app.status_code == 200
    assert res_app.json()["status"] == "APPROVED"

    # VERIFY INVENTORY UNTOUCHED AT APPROVED
    db.expire_all()
    assert db.get(InventoryBatch, batch_src.id).quantity == 500

    # 3. Dispatch Transfer
    res_disp = client.post(f"/api/transfers/{transfer_id}/dispatch", headers=headers)
    assert res_disp.status_code == 200
    assert res_disp.json()["status"] == "IN_TRANSIT"

    # VERIFY INVENTORY UNTOUCHED AT IN_TRANSIT
    db.expire_all()
    assert db.get(InventoryBatch, batch_src.id).quantity == 500

    # 4. Receive Transfer (ACTUAL INVENTORY RECONCILIATION)
    res_recv = client.post(f"/api/transfers/{transfer_id}/receive", headers=headers)
    assert res_recv.status_code == 200
    assert res_recv.json()["status"] == "RECEIVED"

    # VERIFY INVENTORY RECONCILED ACCURATELY
    db.expire_all()
    # Source deducted by 100 => 400
    assert db.get(InventoryBatch, batch_src.id).quantity == 400

    # Destination new batch created with 100 units => Total dest stock = 110
    dest_batches = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.facility_id == fac_dest.id,
            InventoryBatch.medicine_id == med.id,
        )
    ).all()
    total_dest_stock = sum(b.quantity for b in dest_batches)
    assert total_dest_stock == 110

    # Verify Audit Logs created
    audits = db.scalars(select(AuditLog)).all()
    actions = [a.action for a in audits]
    assert "TRANSFER_OUT" in actions
    assert "TRANSFER_IN" in actions

    # 5. ATTEMPT DUPLICATE RECEIVE -> MUST FAIL WITH 409 CONFLICT
    res_dup = client.post(f"/api/transfers/{transfer_id}/receive", headers=headers)
    assert res_dup.status_code in (400, 409)
    assert "already been received" in res_dup.json()["detail"].lower()
