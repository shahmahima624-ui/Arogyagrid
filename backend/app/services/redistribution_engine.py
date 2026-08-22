"""
Phase 8 — Redistribution Engine

Scoring formula (transparent):
    score = urgency_weight + surplus_weight + expiry_rescue_weight + impact_weight
            - distance_penalty - source_risk_penalty

All components normalised to [0, 1] before combining.
Formula documented inline for auditability.
"""
import math
import uuid
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import (
    ConsumptionRecord,
    Facility,
    InventoryBatch,
    Medicine,
    RedistributionRecommendation,
    Warehouse,
)
from app.schemas.redistribution import ScoreBreakdown
from app.services.risk_engine import compute_risk_for_facility_medicine
from app.services.forecasting import extract_time_series

# ─── constants ────────────────────────────────────────────────────────────────

SAFETY_STOCK_DAYS: dict[str, int] = {
    "PHC": 3,
    "CHC": 5,
    "DISTRICT_HOSPITAL": 7,
}

# Distance beyond which the penalty saturates at 1.0 (100 km)
MAX_DISTANCE_KM = 100.0

# Urgency: destinations with <= this many days to stockout are considered urgent
URGENT_DAYS_THRESHOLD = 14.0


# ─── Haversine distance ────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ─── Daily demand helper ───────────────────────────────────────────────────────

def _daily_demand(db: Session, facility_id: uuid.UUID, medicine_id: uuid.UUID) -> float:
    today = date.today()
    start = today - timedelta(days=90)
    records = db.scalars(
        select(ConsumptionRecord).where(
            ConsumptionRecord.facility_id == facility_id,
            ConsumptionRecord.medicine_id == medicine_id,
            ConsumptionRecord.date >= start,
        )
    ).all()
    df = extract_time_series(records, start, today)
    series = df["quantity"].tail(30)
    return float(series.mean()) if not series.empty else 0.0


# ─── Safe surplus calculator ───────────────────────────────────────────────────

def _safe_surplus(
    db: Session,
    facility: Facility,
    medicine_id: uuid.UUID,
    days_horizon: int = 30,
) -> int:
    """
    safe_surplus = source_stock - predicted_source_requirement - source_safety_stock

    source_stock               : sum of unexpired batch quantities
    predicted_source_requirement : daily_demand × days_horizon
    source_safety_stock        : daily_demand × SAFETY_STOCK_DAYS[facility_type]
    """
    today = date.today()
    batches = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.facility_id == facility.id,
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.expiry_date >= today,
            InventoryBatch.quantity > 0,
        )
    ).all()
    total_stock = sum(b.quantity for b in batches)

    demand = _daily_demand(db, facility.id, medicine_id)
    safety_days = SAFETY_STOCK_DAYS.get(facility.facility_type, 3)
    required = demand * (days_horizon + safety_days)
    surplus = max(0, int(total_stock - required))
    return surplus


def _warehouse_surplus(db: Session, warehouse: Warehouse, medicine_id: uuid.UUID) -> int:
    today = date.today()
    batches = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.warehouse_id == warehouse.id,
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.expiry_date >= today,
            InventoryBatch.quantity > 0,
        )
    ).all()
    return sum(b.quantity for b in batches)


# ─── Nearest expiry batch for source (FEFO preference) ────────────────────────

def _nearest_expiry_days(db: Session, facility_id: uuid.UUID, medicine_id: uuid.UUID) -> int | None:
    today = date.today()
    batch = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.facility_id == facility_id,
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.expiry_date >= today,
            InventoryBatch.quantity > 0,
        ).order_by(InventoryBatch.expiry_date.asc()).limit(1)
    ).first()
    if batch:
        return (batch.expiry_date - today).days
    return None


# ─── Core scoring ─────────────────────────────────────────────────────────────

def _score_candidate(
    urgency_days: float,
    safe_surplus: int,
    nearest_expiry_days: int | None,
    distance_km: float | None,
    source_risk_days: float | None,
    transfer_qty: int,
    dest_daily_demand: float,
) -> ScoreBreakdown:
    """
    All sub-scores normalised [0, 1].

    urgency_weight      : 1 - clamp(urgency_days / URGENT_DAYS_THRESHOLD, 0, 1)
                          → higher when destination is closer to stockout
    surplus_weight      : clamp(safe_surplus / 500, 0, 1)
                          → higher when source has more surplus
    expiry_rescue_weight: 1 - clamp(nearest_expiry_days / 180, 0, 1)  if available else 0
                          → bonus when source batch is near expiry (FEFO incentive)
    impact_weight       : clamp(coverage_days / 30, 0, 1)
                          → higher when transfer restores more coverage
    distance_penalty    : clamp(distance_km / MAX_DISTANCE_KM, 0, 1)  if distance known else 0.5
    source_risk_penalty : 1 - clamp(source_risk_days / 30, 0, 1)  if risk known else 0
                          → penalty when source itself is at risk
    """
    def clamp(v: float, lo=0.0, hi=1.0) -> float:
        return max(lo, min(hi, v))

    urgency_w = 1.0 - clamp(urgency_days / URGENT_DAYS_THRESHOLD)
    surplus_w = clamp(safe_surplus / 500.0)

    if nearest_expiry_days is not None:
        expiry_rescue_w = 1.0 - clamp(nearest_expiry_days / 180.0)
    else:
        expiry_rescue_w = 0.0

    coverage_restored = transfer_qty / max(dest_daily_demand, 0.1)
    impact_w = clamp(coverage_restored / 30.0)

    dist_penalty = clamp(distance_km / MAX_DISTANCE_KM) if distance_km is not None else 0.5
    src_risk_penalty = (1.0 - clamp((source_risk_days or 30.0) / 30.0)) if source_risk_days is not None else 0.0

    final = (urgency_w + surplus_w + expiry_rescue_w + impact_w) - (dist_penalty + src_risk_penalty)

    return ScoreBreakdown(
        urgency_weight=round(urgency_w, 4),
        surplus_weight=round(surplus_w, 4),
        expiry_rescue_weight=round(expiry_rescue_w, 4),
        impact_weight=round(impact_w, 4),
        distance_penalty=round(dist_penalty, 4),
        source_risk_penalty=round(src_risk_penalty, 4),
        final_score=round(final, 4),
    )


# ─── Main generation engine ────────────────────────────────────────────────────

def generate_redistribution_recommendations(
    db: Session,
    district_id: uuid.UUID | None = None,
    facility_id: uuid.UUID | None = None,
    top_n: int = 3,
) -> tuple[int, int]:
    """
    Generates and persists redistribution recommendations.

    Returns: (recommendations_created, scenarios_evaluated)
    """
    today = date.today()

    # Fetch active facilities & warehouses
    fac_query = select(Facility).where(Facility.status == "ACTIVE")
    if facility_id:
        fac_query = fac_query.where(Facility.id == facility_id)
    elif district_id:
        fac_query = fac_query.where(Facility.district_id == district_id)
    facilities = db.scalars(fac_query).all()
    facility_map = {f.id: f for f in facilities}

    warehouses = db.scalars(select(Warehouse)).all()
    medicines = db.scalars(select(Medicine)).all()
    medicine_map = {m.id: m for m in medicines}

    # ── Find destination facilities (at risk of stockout within 14 days) ──────
    shortages: list[tuple[Facility, Medicine, float, float]] = []
    for dest_fac in facilities:
        for med in medicines:
            risk = compute_risk_for_facility_medicine(db, dest_fac, med)
            if risk and risk.days_to_stockout is not None and risk.days_to_stockout <= URGENT_DAYS_THRESHOLD:
                daily = _daily_demand(db, dest_fac.id, med.id)
                shortages.append((dest_fac, med, risk.days_to_stockout, daily))

    created = 0
    scenarios = len(shortages)

    for dest_fac, med, days_to_so, dest_daily in shortages:
        # Quantity needed to cover 30 days
        qty_needed = max(1, int(dest_daily * 30))

        candidates = []

        # ── Evaluate facility sources ─────────────────────────────────────────
        for src_fac in facilities:
            if src_fac.id == dest_fac.id:
                continue
            surplus = _safe_surplus(db, src_fac, med.id)
            if surplus <= 0:
                continue

            transfer_qty = min(surplus, qty_needed)

            # Distance
            dist = None
            if (dest_fac.latitude and dest_fac.longitude and src_fac.latitude and src_fac.longitude):
                dist = _haversine_km(dest_fac.latitude, dest_fac.longitude, src_fac.latitude, src_fac.longitude)

            # Source facility own stockout risk
            src_risk = compute_risk_for_facility_medicine(db, src_fac, med)
            src_risk_days = src_risk.days_to_stockout if src_risk else None

            # Reject high-risk sources (themselves at risk of stockout ≤ 7 days)
            if src_risk_days is not None and src_risk_days <= 7:
                continue

            nearest_exp = _nearest_expiry_days(db, src_fac.id, med.id)
            breakdown = _score_candidate(
                urgency_days=days_to_so,
                safe_surplus=surplus,
                nearest_expiry_days=nearest_exp,
                distance_km=dist,
                source_risk_days=src_risk_days,
                transfer_qty=transfer_qty,
                dest_daily_demand=dest_daily,
            )

            coverage_restored = transfer_qty / max(dest_daily, 0.1)
            confidence = min(1.0, max(0.0, (breakdown.final_score + 2) / 4))  # normalise to [0,1]

            reason = (
                f"{src_fac.name} ({src_fac.facility_type}) has a safe surplus of {surplus} {med.unit} "
                f"for {med.name}. Destination {dest_fac.name} will stock out in {days_to_so:.1f} days. "
                f"Transfer of {transfer_qty} {med.unit} restores ~{coverage_restored:.0f} days of coverage."
                + (f" Distance: {dist:.1f} km." if dist else "")
                + (f" Source batch nearest expiry: {nearest_exp}d." if nearest_exp else "")
            )

            candidates.append({
                "source_facility_id": src_fac.id,
                "source_warehouse_id": None,
                "transfer_qty": transfer_qty,
                "surplus": surplus,
                "dist": dist,
                "coverage_restored": coverage_restored,
                "breakdown": breakdown,
                "confidence": round(confidence, 4),
                "reason": reason,
            })

        # ── Evaluate warehouse as fallback ────────────────────────────────────
        for wh in warehouses:
            wh_surplus = _warehouse_surplus(db, wh, med.id)
            if wh_surplus <= 0:
                continue
            transfer_qty = min(wh_surplus, qty_needed)

            dist = None
            if (dest_fac.latitude and dest_fac.longitude and wh.latitude and wh.longitude):
                dist = _haversine_km(dest_fac.latitude, dest_fac.longitude, wh.latitude, wh.longitude)

            breakdown = _score_candidate(
                urgency_days=days_to_so,
                safe_surplus=wh_surplus,
                nearest_expiry_days=None,
                distance_km=dist,
                source_risk_days=None,
                transfer_qty=transfer_qty,
                dest_daily_demand=dest_daily,
            )
            coverage_restored = transfer_qty / max(dest_daily, 0.1)
            confidence = min(1.0, max(0.0, (breakdown.final_score + 2) / 4))

            reason = (
                f"District Warehouse '{wh.name}' has {wh_surplus} {med.unit} of {med.name} available as fallback. "
                f"Destination {dest_fac.name} will stock out in {days_to_so:.1f} days. "
                f"Transfer of {transfer_qty} {med.unit} restores ~{coverage_restored:.0f} days of coverage."
                + (f" Distance: {dist:.1f} km." if dist else "")
            )

            candidates.append({
                "source_facility_id": None,
                "source_warehouse_id": wh.id,
                "transfer_qty": transfer_qty,
                "surplus": wh_surplus,
                "dist": dist,
                "coverage_restored": coverage_restored,
                "breakdown": breakdown,
                "confidence": round(confidence, 4),
                "reason": reason,
            })

        # ── Rank and persist top N ────────────────────────────────────────────
        ranked = sorted(candidates, key=lambda c: c["breakdown"].final_score, reverse=True)[:top_n]

        for c in ranked:
            bd = c["breakdown"]
            rec = RedistributionRecommendation(
                destination_facility_id=dest_fac.id,
                medicine_id=med.id,
                source_facility_id=c["source_facility_id"],
                source_warehouse_id=c["source_warehouse_id"],
                recommended_quantity=c["transfer_qty"],
                status="RECOMMENDED",
                score=bd.final_score,
                urgency_weight=bd.urgency_weight,
                surplus_weight=bd.surplus_weight,
                expiry_rescue_weight=bd.expiry_rescue_weight,
                impact_weight=bd.impact_weight,
                distance_penalty=bd.distance_penalty,
                source_risk_penalty=bd.source_risk_penalty,
                distance_km=c["dist"],
                destination_days_to_stockout=days_to_so,
                source_safe_surplus=c["surplus"],
                estimated_coverage_days_restored=round(c["coverage_restored"], 1),
                reason=c["reason"],
                confidence=c["confidence"],
            )
            db.add(rec)
            created += 1

    db.commit()
    return created, scenarios


def list_recommendations(
    db: Session,
    district_id: uuid.UUID | None = None,
    facility_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[RedistributionRecommendation]:
    q = select(RedistributionRecommendation)
    if status:
        q = q.where(RedistributionRecommendation.status == status)
    if facility_id:
        q = q.where(RedistributionRecommendation.destination_facility_id == facility_id)
    q = q.order_by(RedistributionRecommendation.score.desc())
    return db.scalars(q).all()


def get_recommendation_by_id(db: Session, rec_id: uuid.UUID) -> RedistributionRecommendation | None:
    return db.get(RedistributionRecommendation, rec_id)
