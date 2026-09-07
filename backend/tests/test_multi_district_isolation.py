import uuid
from datetime import date, timedelta, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import (
    District,
    Facility,
    Warehouse,
    User,
    Medicine,
    InventoryBatch,
    ConsumptionRecord,
    AuditLog,
    StockTransfer,
    RedistributionRecommendation,
)

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_multi_district_fixtures():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    # 1. Create Districts
    dist_a = District(id=uuid.UUID("11111111-1111-1111-1111-111111111111"), name="District Alpha", state="Gujarat")
    dist_b = District(id=uuid.UUID("22222222-2222-2222-2222-222222222222"), name="District Beta", state="Gujarat")
    db.add_all([dist_a, dist_b])
    db.flush()

    # 2. Facilities
    phc_a1 = Facility(id=uuid.UUID("aaaaaaaa-1111-0000-0000-000000000001"), district_id=dist_a.id, name="PHC Alpha 1", facility_type="PHC", status="ACTIVE", latitude=23.0, longitude=72.0)
    chc_a2 = Facility(id=uuid.UUID("aaaaaaaa-2222-0000-0000-000000000002"), district_id=dist_a.id, name="CHC Alpha 2", facility_type="CHC", status="ACTIVE", latitude=23.1, longitude=72.1)
    
    phc_b1 = Facility(id=uuid.UUID("bbbbbbbb-1111-0000-0000-000000000001"), district_id=dist_b.id, name="PHC Beta 1", facility_type="PHC", status="ACTIVE", latitude=21.0, longitude=73.0)
    chc_b2 = Facility(id=uuid.UUID("bbbbbbbb-2222-0000-0000-000000000002"), district_id=dist_b.id, name="CHC Beta 2", facility_type="CHC", status="ACTIVE", latitude=21.1, longitude=73.1)
    db.add_all([phc_a1, chc_a2, phc_b1, chc_b2])

    # 3. Warehouses
    wh_a = Warehouse(id=uuid.UUID("aaaaaaaa-9999-0000-0000-000000000001"), district_id=dist_a.id, name="Warehouse Alpha", status="ACTIVE")
    wh_b = Warehouse(id=uuid.UUID("bbbbbbbb-9999-0000-0000-000000000001"), district_id=dist_b.id, name="Warehouse Beta", status="ACTIVE")
    db.add_all([wh_a, wh_b])

    # 4. Medicines
    med1 = Medicine(id=uuid.UUID("99999999-0000-0000-0000-000000000001"), name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotic", unit="tablets")
    med2 = Medicine(id=uuid.UUID("99999999-0000-0000-0000-000000000002"), name="Paracetamol 500mg", generic_name="Paracetamol", category="Analgesic", unit="tablets")
    db.add_all([med1, med2])
    db.flush()

    # 5. Users
    user_admin_a = User(id=uuid.UUID("aaaaaaaa-aaaa-0000-0000-000000000001"), firebase_uid="mock-admin-a", name="Admin Alpha", email="admin_a@test.org", role="DISTRICT_ADMIN", district_id=dist_a.id, status="ACTIVE")
    user_admin_b = User(id=uuid.UUID("bbbbbbbb-bbbb-0000-0000-000000000001"), firebase_uid="mock-admin-b", name="Admin Beta", email="admin_b@test.org", role="DISTRICT_ADMIN", district_id=dist_b.id, status="ACTIVE")
    user_fac_a1 = User(id=uuid.UUID("aaaaaaaa-face-0000-0000-000000000001"), firebase_uid="mock-facility-admin-a1", name="Fac Admin Alpha 1", email="fac_a1@test.org", role="FACILITY_ADMIN", district_id=dist_a.id, facility_id=phc_a1.id, status="ACTIVE")
    user_staff_a1 = User(id=uuid.UUID("aaaaaaaa-5aff-0000-0000-000000000001"), firebase_uid="mock-staff-a1", name="Staff Alpha 1", email="staff_a1@test.org", role="HEALTHCARE_STAFF", district_id=dist_a.id, facility_id=phc_a1.id, status="ACTIVE")
    user_wh_a = User(id=uuid.UUID("aaaaaaaa-784e-0000-0000-000000000001"), firebase_uid="mock-warehouse-manager-a", name="Warehouse Mgr Alpha", email="wh_a@test.org", role="WAREHOUSE_MANAGER", district_id=dist_a.id, status="ACTIVE")
    db.add_all([user_admin_a, user_admin_b, user_fac_a1, user_staff_a1, user_wh_a])

    # 6. Inventory
    today = date.today()
    batch_a1 = InventoryBatch(facility_id=phc_a1.id, medicine_id=med1.id, batch_number="BAT-A1", quantity=100, expiry_date=today + timedelta(days=120))
    batch_b1 = InventoryBatch(facility_id=phc_b1.id, medicine_id=med1.id, batch_number="BAT-B1", quantity=300, expiry_date=today + timedelta(days=120))
    batch_wh_a = InventoryBatch(warehouse_id=wh_a.id, medicine_id=med2.id, batch_number="BAT-WHA", quantity=5000, expiry_date=today + timedelta(days=200))
    db.add_all([batch_a1, batch_b1, batch_wh_a])

    # 7. Audit logs in District A and District B
    log_a = AuditLog(user_id=user_fac_a1.id, facility_id=phc_a1.id, action="STOCK_UPDATE", entity="InventoryBatch", description="Alpha 1 Stock Update", timestamp=datetime.now(timezone.utc))
    log_b = AuditLog(user_id=user_admin_b.id, facility_id=phc_b1.id, action="STOCK_UPDATE", entity="InventoryBatch", description="Beta 1 Stock Update", timestamp=datetime.now(timezone.utc))
    db.add_all([log_a, log_b])

    # 8. Consumption records in District A and District B
    cons_a = ConsumptionRecord(facility_id=phc_a1.id, medicine_id=med1.id, date=today, quantity_consumed=25, patient_count=12)
    cons_b = ConsumptionRecord(facility_id=phc_b1.id, medicine_id=med1.id, date=today, quantity_consumed=80, patient_count=40)
    db.add_all([cons_a, cons_b])

    # 9. Transfers
    tx_b = StockTransfer(
        tracking_number="TRK-BETA-001",
        source_facility_id=phc_b1.id,
        destination_facility_id=chc_b2.id,
        medicine_id=med1.id,
        quantity=50,
        status="PENDING",
        created_by_user_id=user_admin_b.id,
    )
    db.add(tx_b)

    db.commit()
    db.close()


def test_map_district_admin_can_access_own_district():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-admin-a"}
    res = client.get("/api/map/facilities", headers=headers)
    assert res.status_code == 200
    data = res.json()
    markers = data["markers"]
    # Should only return facilities from District Alpha
    facility_names = [m["name"] for m in markers]
    assert "PHC Alpha 1" in facility_names
    assert "CHC Alpha 2" in facility_names
    assert "PHC Beta 1" not in facility_names
    assert "CHC Beta 2" not in facility_names


def test_map_district_admin_cannot_access_other_district():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-admin-a"}
    # Attempting to fetch District Beta explicitly
    res = client.get("/api/map/facilities?district_id=22222222-2222-2222-2222-222222222222", headers=headers)
    assert res.status_code == 403


def test_map_facility_admin_cannot_override_district():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-facility-admin-a1"}
    res = client.get("/api/map/facilities?district_id=22222222-2222-2222-2222-222222222222", headers=headers)
    assert res.status_code == 403


def test_map_warehouse_manager_cannot_override_district():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-warehouse-manager-a"}
    res = client.get("/api/map/facilities?district_id=22222222-2222-2222-2222-222222222222", headers=headers)
    assert res.status_code == 403


def test_dashboard_district_admin_cannot_query_foreign_district():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-admin-a"}
    res = client.get("/api/dashboard/command-center?district_id=22222222-2222-2222-2222-222222222222", headers=headers)
    assert res.status_code == 403


def test_dashboard_facility_admin_cannot_query_foreign_facility():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-facility-admin-a1"}
    res = client.get("/api/dashboard/command-center?facility_id=bbbbbbbb-1111-0000-0000-000000000001", headers=headers)
    assert res.status_code == 403


def test_dashboard_activity_scoped_by_district():
    client = TestClient(app)
    headers_a = {"Authorization": "Bearer mock-admin-a"}
    res_a = client.get("/api/dashboard/command-center", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    activity_a = data_a["recent_activity"]
    descriptions_a = [act["description"] for act in activity_a]
    assert any("Alpha 1" in d for d in descriptions_a)
    assert not any("Beta 1" in d for d in descriptions_a)


def test_dashboard_activity_scoped_by_facility():
    client = TestClient(app)
    headers_fac = {"Authorization": "Bearer mock-facility-admin-a1"}
    res = client.get("/api/dashboard/command-center", headers=headers_fac)
    assert res.status_code == 200
    data = res.json()
    activity = data["recent_activity"]
    # Facility Admin A1 should only see A1 activity, never Beta
    descriptions = [act["description"] for act in activity]
    assert any("Alpha 1" in d for d in descriptions)
    assert not any("Beta 1" in d for d in descriptions)


def test_warehouse_manager_command_center_scoped():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-warehouse-manager-a"}
    res = client.get("/api/dashboard/command-center", headers=headers)
    assert res.status_code == 200
    data = res.json()
    # Scoped to District Alpha facilities only
    fac_names = [f["name"] for f in data["facility_health"]]
    assert "PHC Alpha 1" in fac_names
    assert "CHC Alpha 2" in fac_names
    assert "PHC Beta 1" not in fac_names


def test_warehouse_manager_cannot_view_other_district_dashboard():
    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-warehouse-manager-a"}
    res = client.get("/api/dashboard/command-center?district_id=22222222-2222-2222-2222-222222222222", headers=headers)
    assert res.status_code == 403


def test_public_events_sse_does_not_leak_sensitive_facility_data():
    from app.services.event_service import event_generator
    import asyncio

    async def collect_events():
        gen = event_generator()
        items = []
        async for data in gen:
            items.append(data)
        return items

    events_data = asyncio.run(collect_events())
    assert len(events_data) > 0
    for evt in events_data:
        assert "PHC Sanand" not in evt
        assert "CHC Bavla" not in evt
        assert "PHC Viramgam" not in evt
        assert "stockout" not in evt.lower()
