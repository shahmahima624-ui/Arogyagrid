from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.core import User
from app.main import app


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_core_domain_crud_and_inventory_validation() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    
    mock_user = User(
        firebase_uid="mock-district-admin",
        name="Test District Admin",
        email="district.admin@test.org",
        role="DISTRICT_ADMIN",
        status="ACTIVE"
    )
    
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)


    district = client.post("/api/districts", json={"name": "Test District", "state": "Gujarat"}).json()
    facility = client.post("/api/facilities", json={"district_id": district["id"], "name": "PHC Test", "facility_type": "PHC"}).json()
    medicine = client.post("/api/medicines", json={"name": "Test Medicine", "generic_name": "Test", "category": "Test", "unit": "tablets"}).json()
    payload = {"facility_id": facility["id"], "medicine_id": medicine["id"], "batch_number": "TEST-001", "quantity": 50, "expiry_date": str(date.today() + timedelta(days=30))}
    assert client.post("/api/inventory", json=payload).status_code == 201
    assert len(client.get("/api/inventory", params={"facility_id": facility["id"]}).json()) == 1
    assert client.post("/api/inventory", json={**payload, "quantity": -1}).status_code == 422
    assert client.post("/api/inventory", json={**payload, "warehouse_id": facility["id"]}).status_code == 422
    consumption = client.post("/api/consumption", json={"facility_id": facility["id"], "medicine_id": medicine["id"], "date": str(date.today()), "quantity_consumed": 7, "patient_count": 10})
    assert consumption.status_code == 201
    assert len(client.get("/api/consumption", params={"facility_id": facility["id"]}).json()) == 1
    app.dependency_overrides.clear()
