from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, User


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_consumption_intelligence_returns_gap_filled_chronological_features() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = TestingSession()
    district = District(name="Test district", state="Gujarat")
    db.add(district)
    db.flush()
    facility = Facility(name="PHC Test", facility_type="PHC", district_id=district.id)
    medicine = Medicine(name="Test medicine", generic_name="Test", category="Test", unit="units")
    db.add_all([facility, medicine])
    db.flush()
    today = date.today()
    db.add_all([
        ConsumptionRecord(facility_id=facility.id, medicine_id=medicine.id, date=today - timedelta(days=13), quantity_consumed=10, patient_count=4),
        ConsumptionRecord(facility_id=facility.id, medicine_id=medicine.id, date=today - timedelta(days=12), quantity_consumed=5, patient_count=2),
        ConsumptionRecord(facility_id=facility.id, medicine_id=medicine.id, date=today - timedelta(days=12), quantity_consumed=7, patient_count=3),
        InventoryBatch(facility_id=facility.id, medicine_id=medicine.id, batch_number="VALID", quantity=90, expiry_date=today + timedelta(days=40)),
        InventoryBatch(facility_id=facility.id, medicine_id=medicine.id, batch_number="EXPIRED", quantity=30, expiry_date=today),
    ])
    db.commit()
    user = User(firebase_uid="test-admin", name="Admin", email="admin@test.org", role="DISTRICT_ADMIN", district_id=district.id)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    response = client.get(f"/api/consumption-intelligence/series?facility_id={facility.id}&medicine_id={medicine.id}&days=14")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["series"]) == 14
    assert payload["series"] == sorted(payload["series"], key=lambda point: point["date"])
    assert payload["summary"]["current_usable_stock"] == 90
    assert payload["summary"]["total_consumption"] == 22
    assert payload["series"][1]["quantity_consumed"] == 12
    assert payload["series"][-1]["lag_7"] is not None
    app.dependency_overrides.clear()
