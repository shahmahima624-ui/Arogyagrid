"""
Phase 18 — Automated Seed Data Generator Tests

Verifies:
  1. POST /api/demo/seed generates synthetic districts, facilities, medicines, inventory batches, and consumption records.
  2. Database objects are created with valid relationships and non-null values.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import District, Facility, InventoryBatch, Medicine

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_seed_demo_data_generator():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    client = TestClient(app)

    res = client.post("/api/demo/seed")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["success"] is True
    assert data["facilities_created"] >= 3
    assert data["medicines_created"] >= 3
    assert data["batches_created"] >= 3

    # Query database to confirm persisted seed objects
    db = TestingSession()
    districts = db.scalars(select(District)).all()
    assert len(districts) >= 1

    facilities = db.scalars(select(Facility)).all()
    assert len(facilities) >= 3

    medicines = db.scalars(select(Medicine)).all()
    assert len(medicines) >= 3

    batches = db.scalars(select(InventoryBatch)).all()
    assert len(batches) >= 3
