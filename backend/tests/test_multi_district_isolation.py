import uuid
from datetime import date, timedelta, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
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


# ============================================================================
# LOOP 1 — verify_scope direct unit tests
# ============================================================================

def test_verify_scope_admin_foreign_district_rejected():
    from app.core.dependencies import verify_scope
    from fastapi import HTTPException

    db = TestingSession()
    user = db.scalar(select(User).where(User.firebase_uid == "mock-admin-a"))
    foreign_district = uuid.UUID("22222222-2222-2222-2222-222222222222")

    with pytest.raises(HTTPException) as exc_info:
        verify_scope(user, district_id=foreign_district, db=db)
    assert exc_info.value.status_code == 403
    db.close()


def test_verify_scope_facility_admin_foreign_district_rejected():
    from app.core.dependencies import verify_scope
    from fastapi import HTTPException

    db = TestingSession()
    user = db.scalar(select(User).where(User.firebase_uid == "mock-facility-admin-a1"))
    foreign_district = uuid.UUID("22222222-2222-2222-2222-222222222222")

    with pytest.raises(HTTPException) as exc_info:
        verify_scope(user, district_id=foreign_district, db=db)
    assert exc_info.value.status_code == 403
    db.close()


def test_verify_scope_staff_foreign_district_rejected():
    from app.core.dependencies import verify_scope
    from fastapi import HTTPException

    db = TestingSession()
    user = db.scalar(select(User).where(User.firebase_uid == "mock-staff-a1"))
    foreign_district = uuid.UUID("22222222-2222-2222-2222-222222222222")

    with pytest.raises(HTTPException) as exc_info:
        verify_scope(user, district_id=foreign_district, db=db)
    assert exc_info.value.status_code == 403
    db.close()


def test_verify_scope_warehouse_manager_foreign_district_rejected():
    from app.core.dependencies import verify_scope
    from fastapi import HTTPException

    db = TestingSession()
    user = db.scalar(select(User).where(User.firebase_uid == "mock-warehouse-manager-a"))
    foreign_district = uuid.UUID("22222222-2222-2222-2222-222222222222")

    with pytest.raises(HTTPException) as exc_info:
        verify_scope(user, district_id=foreign_district, db=db)
    assert exc_info.value.status_code == 403
    db.close()


# ============================================================================
# LOOP 2 — GET /api/districts
# ============================================================================

def test_districts_endpoint_scoped_by_user_district():
    client = TestClient(app)
    
    # Admin A sees only Alpha
    res_a = client.get("/api/districts", headers={"Authorization": "Bearer mock-admin-a"})
    assert res_a.status_code == 200
    names_a = [d["name"] for d in res_a.json()]
    assert names_a == ["District Alpha"]

    # Facility Admin A1 sees only Alpha
    res_fa = client.get("/api/districts", headers={"Authorization": "Bearer mock-facility-admin-a1"})
    assert res_fa.status_code == 200
    names_fa = [d["name"] for d in res_fa.json()]
    assert names_fa == ["District Alpha"]

    # Staff A1 sees only Alpha
    res_staff = client.get("/api/districts", headers={"Authorization": "Bearer mock-staff-a1"})
    assert res_staff.status_code == 200
    names_staff = [d["name"] for d in res_staff.json()]
    assert names_staff == ["District Alpha"]

    # Warehouse Manager A sees only Alpha
    res_wh = client.get("/api/districts", headers={"Authorization": "Bearer mock-warehouse-manager-a"})
    assert res_wh.status_code == 200
    names_wh = [d["name"] for d in res_wh.json()]
    assert names_wh == ["District Alpha"]

    # Admin B sees only Beta
    res_b = client.get("/api/districts", headers={"Authorization": "Bearer mock-admin-b"})
    assert res_b.status_code == 200
    names_b = [d["name"] for d in res_b.json()]
    assert names_b == ["District Beta"]


# ============================================================================
# LOOP 3 — GET /api/facilities
# ============================================================================

def test_admin_lists_only_own_district_facilities():
    client = TestClient(app)
    res = client.get("/api/facilities", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    names = [f["name"] for f in res.json()]
    assert "PHC Alpha 1" in names
    assert "CHC Alpha 2" in names
    assert "PHC Beta 1" not in names
    assert "CHC Beta 2" not in names


def test_admin_cannot_request_foreign_district_facilities():
    client = TestClient(app)
    res = client.get("/api/facilities?district_id=22222222-2222-2222-2222-222222222222", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_facility_admin_lists_only_own_facility():
    client = TestClient(app)
    res = client.get("/api/facilities", headers={"Authorization": "Bearer mock-facility-admin-a1"})
    assert res.status_code == 200
    names = [f["name"] for f in res.json()]
    assert names == ["PHC Alpha 1"]


def test_staff_lists_only_own_facility():
    client = TestClient(app)
    res = client.get("/api/facilities", headers={"Authorization": "Bearer mock-staff-a1"})
    assert res.status_code == 200
    names = [f["name"] for f in res.json()]
    assert names == ["PHC Alpha 1"]


def test_warehouse_manager_lists_only_own_district_facilities():
    client = TestClient(app)
    res = client.get("/api/facilities", headers={"Authorization": "Bearer mock-warehouse-manager-a"})
    assert res.status_code == 200
    names = [f["name"] for f in res.json()]
    assert "PHC Alpha 1" in names
    assert "CHC Alpha 2" in names
    assert "PHC Beta 1" not in names


# ============================================================================
# LOOP 4 — GET /api/warehouses
# ============================================================================

def test_admin_warehouses_scoped_to_district():
    client = TestClient(app)
    res = client.get("/api/warehouses", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    names = [w["name"] for w in res.json()]
    assert names == ["Warehouse Alpha"]


def test_admin_foreign_district_warehouses_rejected():
    client = TestClient(app)
    res = client.get("/api/warehouses?district_id=22222222-2222-2222-2222-222222222222", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_warehouse_manager_warehouses_scoped():
    client = TestClient(app)
    res = client.get("/api/warehouses", headers={"Authorization": "Bearer mock-warehouse-manager-a"})
    assert res.status_code == 200
    names = [w["name"] for w in res.json()]
    assert names == ["Warehouse Alpha"]


# ============================================================================
# LOOP 5 — GET /api/inventory
# ============================================================================

def test_admin_inventory_scoped_to_district():
    client = TestClient(app)
    res = client.get("/api/inventory", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    batches = [b["batch_number"] for b in res.json()]
    assert "BAT-A1" in batches
    assert "BAT-WHA" in batches
    assert "BAT-B1" not in batches


def test_admin_cannot_request_foreign_facility_inventory():
    client = TestClient(app)
    # PHC Beta 1 is in District Beta
    res = client.get("/api/inventory?facility_id=bbbbbbbb-1111-0000-0000-000000000001", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_facility_admin_inventory_scoped():
    client = TestClient(app)
    res = client.get("/api/inventory", headers={"Authorization": "Bearer mock-facility-admin-a1"})
    assert res.status_code == 200
    batches = [b["batch_number"] for b in res.json()]
    assert batches == ["BAT-A1"]


def test_staff_inventory_scoped():
    client = TestClient(app)
    res = client.get("/api/inventory", headers={"Authorization": "Bearer mock-staff-a1"})
    assert res.status_code == 200
    batches = [b["batch_number"] for b in res.json()]
    assert batches == ["BAT-A1"]


def test_warehouse_manager_inventory_scoped():
    client = TestClient(app)
    res = client.get("/api/inventory", headers={"Authorization": "Bearer mock-warehouse-manager-a"})
    assert res.status_code == 200
    batches = [b["batch_number"] for b in res.json()]
    assert batches == ["BAT-WHA"]


def test_inventory_does_not_mix_districts():
    client = TestClient(app)
    res_b = client.get("/api/inventory", headers={"Authorization": "Bearer mock-admin-b"})
    assert res_b.status_code == 200
    batches_b = [b["batch_number"] for b in res_b.json()]
    assert "BAT-B1" in batches_b
    assert "BAT-A1" not in batches_b
    assert "BAT-WHA" not in batches_b


# ============================================================================
# LOOP 6 — GET /api/consumption
# ============================================================================

def test_admin_consumption_scoped_to_district():
    client = TestClient(app)
    res = client.get("/api/consumption", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    records = res.json()
    assert len(records) == 1
    assert records[0]["facility_id"] == "aaaaaaaa-1111-0000-0000-000000000001"


def test_admin_foreign_facility_consumption_rejected():
    client = TestClient(app)
    res = client.get("/api/consumption?facility_id=bbbbbbbb-1111-0000-0000-000000000001", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_facility_admin_consumption_scoped():
    client = TestClient(app)
    res = client.get("/api/consumption", headers={"Authorization": "Bearer mock-facility-admin-a1"})
    assert res.status_code == 200
    records = res.json()
    assert len(records) == 1
    assert records[0]["facility_id"] == "aaaaaaaa-1111-0000-0000-000000000001"


def test_staff_consumption_scoped():
    client = TestClient(app)
    res = client.get("/api/consumption", headers={"Authorization": "Bearer mock-staff-a1"})
    assert res.status_code == 200
    records = res.json()
    assert len(records) == 1
    assert records[0]["facility_id"] == "aaaaaaaa-1111-0000-0000-000000000001"


def test_warehouse_manager_consumption_forbidden():
    client = TestClient(app)
    res = client.get("/api/consumption", headers={"Authorization": "Bearer mock-warehouse-manager-a"})
    assert res.status_code == 403


# ============================================================================
# LOOP 7 — GET /api/audit-logs
# ============================================================================

def test_audit_logs_scoped_to_admin_district():
    client = TestClient(app)
    res = client.get("/api/audit-logs", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    logs = res.json()
    descriptions = [l["description"] for l in logs]
    assert "Alpha 1 Stock Update" in descriptions
    assert "Beta 1 Stock Update" not in descriptions


def test_audit_logs_hide_foreign_district():
    client = TestClient(app)
    res_b = client.get("/api/audit-logs", headers={"Authorization": "Bearer mock-admin-b"})
    assert res_b.status_code == 200
    logs_b = res_b.json()
    descriptions_b = [l["description"] for l in logs_b]
    assert "Beta 1 Stock Update" in descriptions_b
    assert "Alpha 1 Stock Update" not in descriptions_b


# ============================================================================
# LOOP 8 — GET /api/users
# ============================================================================

def test_users_endpoint_scoped_to_admin_district():
    client = TestClient(app)
    res = client.get("/api/users", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    names = [u["name"] for u in res.json()]
    assert "Admin Alpha" in names
    assert "Fac Admin Alpha 1" in names
    assert "Staff Alpha 1" in names
    assert "Warehouse Mgr Alpha" in names
    assert "Admin Beta" not in names


def test_admin_cannot_query_foreign_district_users():
    client = TestClient(app)
    res = client.get("/api/users?district_id=22222222-2222-2222-2222-222222222222", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_role_filter_does_not_bypass_district_scope():
    client = TestClient(app)
    res = client.get("/api/users?role=DISTRICT_ADMIN", headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 200
    names = [u["name"] for u in res.json()]
    assert "Admin Alpha" in names
    assert "Admin Beta" not in names


def test_facility_admin_cannot_list_users():
    client = TestClient(app)
    res = client.get("/api/users", headers={"Authorization": "Bearer mock-facility-admin-a1"})
    assert res.status_code == 403


# ============================================================================
# LOOP 9 — Resource Creation District Scoping
# ============================================================================

def test_admin_cannot_create_facility_in_foreign_district():
    client = TestClient(app)
    payload = {
        "district_id": "22222222-2222-2222-2222-222222222222",
        "name": "Malicious PHC in Beta",
        "facility_type": "PHC"
    }
    res = client.post("/api/facilities", json=payload, headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_admin_cannot_create_warehouse_in_foreign_district():
    client = TestClient(app)
    payload = {
        "district_id": "22222222-2222-2222-2222-222222222222",
        "name": "Malicious Warehouse in Beta"
    }
    res = client.post("/api/warehouses", json=payload, headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_admin_cannot_add_inventory_to_foreign_district_resource():
    client = TestClient(app)
    payload = {
        "facility_id": "bbbbbbbb-1111-0000-0000-000000000001",
        "medicine_id": "99999999-0000-0000-0000-000000000001",
        "batch_number": "MAL-001",
        "quantity": 100,
        "expiry_date": str(date.today() + timedelta(days=90))
    }
    res = client.post("/api/inventory", json=payload, headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


def test_admin_cannot_record_consumption_for_foreign_district_facility():
    client = TestClient(app)
    payload = {
        "facility_id": "bbbbbbbb-1111-0000-0000-000000000001",
        "medicine_id": "99999999-0000-0000-0000-000000000001",
        "date": str(date.today()),
        "quantity_consumed": 10,
        "patient_count": 5
    }
    res = client.post("/api/consumption", json=payload, headers={"Authorization": "Bearer mock-admin-a"})
    assert res.status_code == 403


# ============================================================================
# LOOP 10 — Map Transfer Route Isolation
# ============================================================================

def test_map_routes_scoped_to_authorized_district():
    client = TestClient(app)
    res_a = client.get("/api/map/facilities", headers={"Authorization": "Bearer mock-admin-a"})
    assert res_a.status_code == 200
    data_a = res_a.json()
    # TRK-BETA-001 involves District Beta facilities (PHC Beta 1 -> CHC Beta 2)
    # Admin A map should NOT have this transfer route
    routes = data_a["transfer_routes"]
    assert len(routes) == 0


# ============================================================================
# LOOP 14 — Reports CSV & Manifest Scoping
# ============================================================================

def test_report_csv_export_scoped_to_district():
    client = TestClient(app)
    # Admin A exports inventory CSV
    res_inv = client.get("/api/reports/export-csv?type=inventory", headers={"Authorization": "Bearer mock-admin-a"})
    assert res_inv.status_code == 200
    content = res_inv.text
    assert "BAT-A1" in content
    assert "BAT-WHA" in content
    assert "BAT-B1" not in content

    # Staff A1 cannot export audit logs
    res_audit = client.get("/api/reports/export-csv?type=audit", headers={"Authorization": "Bearer mock-staff-a1"})
    assert res_audit.status_code == 403


# ============================================================================
# LOOP 20 — Cross-Role Privilege & RBAC Tests
# ============================================================================

def test_staff_cannot_access_audit_logs():
    client = TestClient(app)
    res = client.get("/api/audit-logs", headers={"Authorization": "Bearer mock-staff-a1"})
    assert res.status_code == 403


def test_facility_admin_cannot_create_warehouse():
    client = TestClient(app)
    payload = {"district_id": "11111111-1111-1111-1111-111111111111", "name": "Unauthorized WH"}
    res = client.post("/api/warehouses", json=payload, headers={"Authorization": "Bearer mock-facility-admin-a1"})
    assert res.status_code == 403


def test_warehouse_manager_cannot_create_facility():
    client = TestClient(app)
    payload = {"district_id": "11111111-1111-1111-1111-111111111111", "name": "Unauthorized PHC", "facility_type": "PHC"}
    res = client.post("/api/facilities", json=payload, headers={"Authorization": "Bearer mock-warehouse-manager-a"})
    assert res.status_code == 403

