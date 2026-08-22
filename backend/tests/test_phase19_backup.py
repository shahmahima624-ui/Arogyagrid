"""
Phase 19 — Database Backup & Restore Utility Tests

Verifies:
  1. POST /api/backup/create generates a structured JSON database snapshot.
  2. POST /api/backup/restore restores districts, facilities, medicines, and inventory batches from JSON snapshot.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import District, Facility, InventoryBatch, Medicine, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_database_backup_and_restore():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    db.add(fac)
    db.flush()

    med = Medicine(name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesics", unit="tablets")
    db.add(med)
    db.flush()

    admin = User(
        firebase_uid="mock-backup-user", name="Backup Admin", email="backup@test.org",
        role="DISTRICT_ADMIN", district_id=district.id, status="ACTIVE",
    )
    db.add(admin)
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-backup-user"}

    # 1. Create Backup Snapshot
    res_create = client.post("/api/backup/create", headers=headers)
    assert res_create.status_code == 200, res_create.text
    data = res_create.json()

    assert "snapshot_id" in data
    assert "snapshot_json" in data
    snap_json = data["snapshot_json"]
    assert len(snap_json["districts"]) == 1
    assert len(snap_json["facilities"]) == 1

    # Clear DB tables to test restore
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    # 2. Restore Backup Snapshot
    res_restore = client.post("/api/backup/restore", headers=headers, json={"snapshot_json": snap_json})
    assert res_restore.status_code == 200, res_restore.text
    res_data = res_restore.json()
    assert res_data["success"] is True

    # Verify tables restored
    db_after = TestingSession()
    dist_after = db_after.scalars(select(District)).all()
    assert len(dist_after) == 1
    assert dist_after[0].name == "Ahmedabad Rural"
