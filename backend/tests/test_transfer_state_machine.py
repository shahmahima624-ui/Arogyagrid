"""
Transfer State Machine & Safe Surplus Regression Test Suite

Tests all allowed and forbidden state transitions, safe surplus
enforcement, stale recommendation rejection, and audit log creation.

Allowed transitions:
    PENDING    → approve  → APPROVED
    PENDING    → reject   → REJECTED
    PENDING    → cancel   → CANCELLED
    APPROVED   → dispatch → IN_TRANSIT
    APPROVED   → cancel   → CANCELLED
    IN_TRANSIT → receive  → RECEIVED

Everything else → 409 Conflict
"""
import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import (
    ConsumptionRecord,
    District,
    Facility,
    InventoryBatch,
    Medicine,
    StockTransfer,
    TransferStatus,
    User,
    UserRole,
)
from app.services import transfer_service
from app.services.safety_service import calculate_safe_surplus, PROTECTION_HORIZON_DAYS, SAFETY_STOCK_DAYS

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def setup_db():
    """Create tables and seed baseline test data."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = _override_db

    db = TestingSession()
    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_a = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    fac_b = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC", status="ACTIVE")
    db.add_all([fac_a, fac_b])
    db.flush()

    med = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="capsules")
    db.add(med)
    db.flush()

    today = date.today()
    # Facility A has 500 units — plenty for safe surplus when no consumption history
    batch_a = InventoryBatch(
        facility_id=fac_a.id, medicine_id=med.id,
        batch_number="BAT-A-001", quantity=500, expiry_date=today + timedelta(days=180)
    )
    # Facility B has 200 units
    batch_b = InventoryBatch(
        facility_id=fac_b.id, medicine_id=med.id,
        batch_number="BAT-B-001", quantity=200, expiry_date=today + timedelta(days=180)
    )
    db.add_all([batch_a, batch_b])

    admin = User(
        firebase_uid="mock-district-admin",
        name="District Admin",
        email="admin@test.org",
        role=UserRole.DISTRICT_ADMIN.value,
        district_id=district.id,
        status="ACTIVE",
    )
    db.add(admin)
    db.commit()
    db.close()


def _override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def _get_fixtures():
    """Helper to return (db, fac_a, fac_b, med, admin) from test DB."""
    db = TestingSession()
    facilities = db.scalars(select(Facility)).all()
    med = db.scalar(select(Medicine))
    admin = db.scalar(select(User).where(User.role == UserRole.DISTRICT_ADMIN.value))
    return db, facilities[0], facilities[1], med, admin


def _make_pending(db, fac_a, fac_b, med, admin, qty=50):
    """Create a PENDING transfer from fac_a → fac_b."""
    return transfer_service.create_manual_transfer(
        db=db,
        source_facility_id=fac_a.id,
        source_warehouse_id=None,
        destination_facility_id=fac_b.id,
        medicine_id=med.id,
        quantity=qty,
        user=admin,
    )


# ─── State Machine: Allowed Transitions ───────────────────────────────────────

def test_sm_pending_approve_success():
    """PENDING → APPROVED is allowed."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    assert transfer.status == TransferStatus.PENDING

    approved = transfer_service.approve_transfer(db, transfer.id, admin)
    assert approved.status == TransferStatus.APPROVED
    db.close()


def test_sm_approved_dispatch_success():
    """APPROVED → IN_TRANSIT is allowed."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)

    dispatched = transfer_service.dispatch_transfer(db, transfer.id, admin)
    assert dispatched.status == TransferStatus.IN_TRANSIT
    db.close()


def test_sm_in_transit_receive_success():
    """IN_TRANSIT → RECEIVED is allowed."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)
    transfer_service.dispatch_transfer(db, transfer.id, admin)

    received = transfer_service.receive_transfer(db, transfer.id, admin)
    assert received.status == TransferStatus.RECEIVED
    db.close()


def test_sm_pending_reject_success():
    """PENDING → REJECTED is allowed."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)

    rejected = transfer_service.reject_transfer(db, transfer.id, admin)
    assert rejected.status == TransferStatus.REJECTED
    db.close()


def test_sm_pending_cancel_success():
    """PENDING → CANCELLED is allowed."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)

    cancelled = transfer_service.cancel_transfer(db, transfer.id, admin)
    assert cancelled.status == TransferStatus.CANCELLED
    db.close()


def test_sm_approved_cancel_success():
    """APPROVED → CANCELLED is allowed."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)

    cancelled = transfer_service.cancel_transfer(db, transfer.id, admin)
    assert cancelled.status == TransferStatus.CANCELLED
    db.close()


# ─── State Machine: FORBIDDEN Transitions → 409 ───────────────────────────────

def test_sm_pending_cannot_dispatch():
    """PENDING → IN_TRANSIT must be blocked (must be APPROVED first)."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)

    try:
        transfer_service.dispatch_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert "409" in str(e.status_code) or e.status_code == 409
        assert "APPROVED before dispatch" in e.detail
    db.close()


def test_sm_pending_cannot_receive():
    """PENDING → RECEIVED must be blocked."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)

    try:
        transfer_service.receive_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert e.status_code == 409
        assert "IN_TRANSIT before receipt" in e.detail
    db.close()


def test_sm_approved_cannot_receive():
    """APPROVED → RECEIVED must be blocked (must dispatch first)."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)

    try:
        transfer_service.receive_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert e.status_code == 409
        assert "IN_TRANSIT before receipt" in e.detail
    db.close()


def test_sm_received_is_terminal_no_approve():
    """RECEIVED → approve must be blocked (terminal state)."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)
    transfer_service.dispatch_transfer(db, transfer.id, admin)
    transfer_service.receive_transfer(db, transfer.id, admin)

    try:
        transfer_service.approve_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert e.status_code == 409
    db.close()


def test_sm_received_is_terminal_no_dispatch():
    """RECEIVED → dispatch must be blocked (terminal state)."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)
    transfer_service.dispatch_transfer(db, transfer.id, admin)
    transfer_service.receive_transfer(db, transfer.id, admin)

    try:
        transfer_service.dispatch_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert e.status_code == 409
    db.close()


def test_sm_received_is_terminal_no_cancel():
    """RECEIVED → cancel must be blocked (terminal state)."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.approve_transfer(db, transfer.id, admin)
    transfer_service.dispatch_transfer(db, transfer.id, admin)
    transfer_service.receive_transfer(db, transfer.id, admin)

    try:
        transfer_service.cancel_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert e.status_code == 409
    db.close()


def test_sm_rejected_is_terminal():
    """REJECTED → any action must be blocked (terminal state)."""
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin)
    transfer_service.reject_transfer(db, transfer.id, admin)

    try:
        transfer_service.approve_transfer(db, transfer.id, admin)
        assert False, "Expected 409"
    except Exception as e:
        assert e.status_code == 409

    try:
        transfer_service.dispatch_transfer(db, transfer.id, admin)
        assert False, "Expected 409"
    except Exception as e:
        assert e.status_code == 409

    try:
        transfer_service.cancel_transfer(db, transfer.id, admin)
        assert False, "Expected 409"
    except Exception as e:
        assert e.status_code == 409
    db.close()


# ─── Safe Surplus Tests ────────────────────────────────────────────────────────

def _seed_consumption(db, facility_id, medicine_id, daily_qty: int, days: int = 90):
    """Seed consistent consumption records to establish daily demand."""
    today = date.today()
    for i in range(days):
        rec_date = today - timedelta(days=i + 1)
        db.add(ConsumptionRecord(
            facility_id=facility_id,
            medicine_id=medicine_id,
            date=rec_date,
            quantity_consumed=daily_qty,
        ))
    db.commit()


def test_safe_surplus_scenario_a_allowed():
    """
    Scenario A:
        stock=500, daily_demand=10, horizon=14, safety_days=3 (PHC)
        predicted_requirement = 10 * 14 = 140
        safety_stock = 10 * 3 = 30
        safe_surplus = 500 - 140 - 30 = 330
        transfer=80 → ALLOWED
    """
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    _seed_consumption(db, fac_a.id, med.id, daily_qty=10)

    result = calculate_safe_surplus(db, fac_a.id, med.id)
    assert result.evaluation_available
    assert result.safe_surplus > 0
    assert result.safe_surplus >= 80  # 330 >> 80

    # Transfer of 80 should be accepted
    transfer = _make_pending(db, fac_a, fac_b, med, admin, qty=80)
    assert transfer.status == TransferStatus.PENDING
    db.close()


def test_safe_surplus_scenario_b_blocked():
    """
    Scenario B:
        stock=500, daily_demand=10, horizon=14, safety_days=3
        safe_surplus = 330
        Transfer of 400 > 330 → BLOCKED with 409
    """
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    _seed_consumption(db, fac_a.id, med.id, daily_qty=10)

    result = calculate_safe_surplus(db, fac_a.id, med.id)
    safe = result.safe_surplus  # e.g., 330

    # Transfer 1 more than safe surplus → must be blocked
    try:
        _make_pending(db, fac_a, fac_b, med, admin, qty=safe + 10)
        assert False, "Expected 409 Conflict"
    except Exception as e:
        assert e.status_code == 409
        assert "safe surplus" in e.detail.lower()
    db.close()


def test_stale_recommendation_rejected_at_approval():
    """
    Scenario C (stale recommendation):
        - Create transfer with qty=50 while surplus is large
        - Drain source stock so surplus < 50
        - Attempt approval → 409 Conflict
    """
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    _seed_consumption(db, fac_a.id, med.id, daily_qty=10)

    # Create transfer while surplus is healthy
    transfer = _make_pending(db, fac_a, fac_b, med, admin, qty=50)

    # Now drain source stock to below safe threshold
    batches = db.scalars(
        select(InventoryBatch).where(InventoryBatch.facility_id == fac_a.id)
    ).all()
    for b in batches:
        b.quantity = 20  # far below safe surplus for demand=10/day

    db.commit()

    # Approval must now be rejected as recommendation is stale
    try:
        transfer_service.approve_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict — stale recommendation"
    except Exception as e:
        assert e.status_code == 409
        assert "safe surplus" in e.detail.lower() or "regenerate" in e.detail.lower()
    db.close()


def test_stale_recommendation_rejected_at_dispatch():
    """
    Stock drains between approval and dispatch → 409 at dispatch.
    """
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    _seed_consumption(db, fac_a.id, med.id, daily_qty=5)

    transfer = _make_pending(db, fac_a, fac_b, med, admin, qty=30)
    transfer_service.approve_transfer(db, transfer.id, admin)

    # Drain stock after approval
    batches = db.scalars(
        select(InventoryBatch).where(InventoryBatch.facility_id == fac_a.id)
    ).all()
    for b in batches:
        b.quantity = 5  # below safe level
    db.commit()

    try:
        transfer_service.dispatch_transfer(db, transfer.id, admin)
        assert False, "Expected 409 Conflict — stale at dispatch"
    except Exception as e:
        assert e.status_code == 409
    db.close()


def test_safe_surplus_formula_correctness():
    """
    Verify the safe surplus formula matches expected values.
    PHC: safety_days=3, horizon=14
    stock=500, daily_demand=10
    predicted_requirement = 10 * 14 = 140
    safety_stock = 10 * 3 = 30
    safe_surplus = 500 - 140 - 30 = 330
    """
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    _seed_consumption(db, fac_a.id, med.id, daily_qty=10)

    result = calculate_safe_surplus(db, fac_a.id, med.id)

    assert result.evaluation_available
    assert result.current_stock == 500
    assert abs(result.predicted_daily_demand - 10.0) < 1.0  # within 10% of 10
    assert result.protection_horizon_days == PROTECTION_HORIZON_DAYS
    # safe_surplus should be close to 330 (within rounding)
    expected = 500 - (10 * PROTECTION_HORIZON_DAYS) - (10 * SAFETY_STOCK_DAYS["PHC"])
    assert abs(result.safe_surplus - expected) <= 15  # tolerance for avg demand rounding
    db.close()


def test_no_consumption_history_falls_back_to_raw_stock():
    """
    If there is no consumption history, evaluation_available=False
    and only a raw stock check is performed.
    """
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()

    # No consumption records seeded
    result = calculate_safe_surplus(db, fac_a.id, med.id)
    assert not result.evaluation_available
    assert result.safe_surplus == 500  # full stock when no demand data
    db.close()


def test_audit_logs_created_for_full_lifecycle():
    """Verify all transfer lifecycle audit events are created."""
    from app.models.core import AuditLog
    setup_db()
    db, fac_a, fac_b, med, admin = _get_fixtures()
    transfer = _make_pending(db, fac_a, fac_b, med, admin, qty=10)
    transfer_service.approve_transfer(db, transfer.id, admin)
    transfer_service.dispatch_transfer(db, transfer.id, admin)
    transfer_service.receive_transfer(db, transfer.id, admin)

    logs = db.scalars(
        select(AuditLog).where(AuditLog.entity == "StockTransfer")
    ).all()
    actions = {log.action for log in logs}

    assert "TRANSFER_CREATED" in actions
    assert "TRANSFER_APPROVED" in actions
    assert "TRANSFER_DISPATCHED" in actions
    assert "TRANSFER_RECEIVED" in actions
    db.close()
