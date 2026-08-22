"""
Safety Service — Centralised Safe Surplus Calculator

Single source of truth for determining whether a source facility or warehouse
can safely donate stock without imperilling its own patients.

Formula
-------
    safe_surplus = current_usable_stock
                   - predicted_requirement  (daily_demand × protection_horizon_days)
                   - safety_stock           (daily_demand × safety_stock_days)

Configuration
-------------
    SAFETY_STOCK_DAYS   : per-facility-type minimum days of cover to protect
    PROTECTION_HORIZON_DAYS : look-ahead window for demand projection
"""
import uuid
from datetime import date, timedelta
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import ConsumptionRecord, Facility, InventoryBatch

# ─── Configurable constants ────────────────────────────────────────────────────

# Minimum safety-stock days per facility type (conservative defaults)
SAFETY_STOCK_DAYS: dict[str, int] = {
    "PHC": 3,
    "CHC": 5,
    "DISTRICT_HOSPITAL": 7,
}

# Forward-looking protection window (days)
PROTECTION_HORIZON_DAYS = 14


# ─── Output dataclass ─────────────────────────────────────────────────────────

@dataclass
class SafeSurplusResult:
    current_stock: int
    predicted_daily_demand: float
    protection_horizon_days: int
    predicted_requirement: float
    safety_stock: float
    safe_surplus: int       # Always >= 0; clamped at 0 if negative
    evaluation_available: bool  # False when no consumption history exists


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _compute_daily_demand(
    db: Session,
    facility_id: uuid.UUID,
    medicine_id: uuid.UUID,
    lookback_days: int = 90,
) -> float:
    """Rolling 30-day mean demand derived from the last `lookback_days` of records."""
    today = date.today()
    start = today - timedelta(days=lookback_days)

    records = db.scalars(
        select(ConsumptionRecord).where(
            ConsumptionRecord.facility_id == facility_id,
            ConsumptionRecord.medicine_id == medicine_id,
            ConsumptionRecord.date >= start,
        )
    ).all()

    if not records:
        return 0.0

    # Aggregate by date
    daily: dict[date, float] = {}
    for r in records:
        d = getattr(r, "date", None)
        if d:
            daily[d] = daily.get(d, 0.0) + r.quantity_consumed

    if not daily:
        return 0.0

    # Mean of the rolling 30-day window
    values = list(daily.values())
    window = values[-30:] if len(values) >= 30 else values
    return float(sum(window) / len(window))


# ─── Public API ───────────────────────────────────────────────────────────────

def calculate_safe_surplus(
    db: Session,
    source_facility_id: uuid.UUID,
    medicine_id: uuid.UUID,
) -> SafeSurplusResult:
    """
    Calculate how many units a facility can safely donate.

    Returns a SafeSurplusResult with full breakdown for audit/logging.
    """
    today = date.today()

    # 1. Current usable (non-expired, positive quantity) stock
    batches = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.facility_id == source_facility_id,
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.expiry_date >= today,
            InventoryBatch.quantity > 0,
        )
    ).all()
    current_stock = sum(b.quantity for b in batches)

    # 2. Predicted daily demand
    daily_demand = _compute_daily_demand(db, source_facility_id, medicine_id)
    evaluation_available = daily_demand > 0

    # 3. Facility-type safety days
    facility = db.get(Facility, source_facility_id)
    fac_type = facility.facility_type if facility else "PHC"
    safety_days = SAFETY_STOCK_DAYS.get(fac_type, 3)

    # 4. Formula
    predicted_requirement = daily_demand * PROTECTION_HORIZON_DAYS
    safety_stock = daily_demand * safety_days
    raw_surplus = current_stock - predicted_requirement - safety_stock
    safe_surplus = max(0, int(raw_surplus))

    return SafeSurplusResult(
        current_stock=current_stock,
        predicted_daily_demand=daily_demand,
        protection_horizon_days=PROTECTION_HORIZON_DAYS,
        predicted_requirement=round(predicted_requirement, 2),
        safety_stock=round(safety_stock, 2),
        safe_surplus=safe_surplus,
        evaluation_available=evaluation_available,
    )
