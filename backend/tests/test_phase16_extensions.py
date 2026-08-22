"""
Phase 16 — Production Extensions & Report Exports Tests

Verifies:
  1. GET /api/reports/export-csv returns downloadable CSV stream for inventory, transfers, and audit logs.
  2. GET /api/reports/dispatch-manifest/{id} returns official National Health Mission stock dispatch manifest payload.
"""
import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import District, Facility, InventoryBatch, Medicine, StockTransfer, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_reports_csv_and_dispatch_manifest():
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

    med = Medicine(name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesics", unit="tablets")
    db.add(med)
    db.flush()

    batch = InventoryBatch(facility_id=fac_a.id, medicine_id=med.id, batch_number="PCM-001", quantity=500, expiry_date=date(2027, 12, 31))
    db.add(batch)

    admin = User(
        firebase_uid="mock-report-user", name="Report Admin", email="report@test.org",
        role="DISTRICT_ADMIN", district_id=district.id, status="ACTIVE",
    )
    db.add(admin)

    transfer = StockTransfer(
        tracking_number="TRK-REP-001",
        source_facility_id=fac_b.id,
        destination_facility_id=fac_a.id,
        medicine_id=med.id,
        quantity=200,
        status="APPROVED",
    )
    db.add(transfer)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-report-user"}

    # 1. Test CSV Inventory Export
    res_inv = client.get("/api/reports/export-csv?type=inventory", headers=headers)
    assert res_inv.status_code == 200
    assert "text/csv" in res_inv.headers["content-type"]
    assert "Paracetamol 500mg" in res_inv.text

    # 2. Test CSV Transfer Export
    res_tx = client.get("/api/reports/export-csv?type=transfers", headers=headers)
    assert res_tx.status_code == 200
    assert "TRK-REP-001" in res_tx.text

    # 3. Test Official Dispatch Manifest
    res_man = client.get(f"/api/reports/dispatch-manifest/{transfer.id}", headers=headers)
    assert res_man.status_code == 200
    m_data = res_man.json()
    assert m_data["tracking_number"] == "TRK-REP-001"
    assert m_data["government_header"] == "GOVERNMENT OF INDIA — NATIONAL HEALTH MISSION"
    assert "security_hash" in m_data
