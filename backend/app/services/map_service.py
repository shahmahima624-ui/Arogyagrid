"""
Phase 14 — Geographic Network Map Service

Aggregates facility risk status, medicine criticality, expiry alerts,
and pending transfer routes into a single geo-enriched payload for the
Leaflet.js map visualisation.

Color Scheme:
  green  = Healthy (no critical/expiring items)
  yellow = At Risk (1-2 critical or expiring medicines)
  orange = High Risk (3+ critical or stockout <7 days on one medicine)
  red    = Critical (stockout imminent on 2+ medicines OR days_to_stockout < 3)
  purple = Expiry / Overstock Opportunity (large surplus + expiry risk)
"""

import random
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core import (
    District,
    Facility,
    InventoryBatch,
    Medicine,
    RedistributionRecommendation,
    StockTransfer,
)
from app.schemas.map import FacilityMapMarker, MapResponse, TransferRoute

# ---------------------------------------------------------------------------
# Default Gujarat district coordinates for simulation
# ---------------------------------------------------------------------------
_DISTRICT_COORDS: dict[str, tuple[float, float]] = {
    "Ahmedabad Rural": (23.0225, 72.5714),
    "Gandhinagar":    (23.2156, 72.6369),
    "Mehsana":        (23.5880, 72.3693),
    "Anand":          (22.5645, 72.9289),
    "Vadodara":       (22.3072, 73.1812),
    "Surat":          (21.1702, 72.8311),
    "Rajkot":         (22.3039, 70.8022),
}

_DEFAULT_CENTER = (23.0225, 72.5714)   # Ahmedabad Rural

_PHC_JITTER_RADIUS = 0.18   # degrees (~20 km spread for PHC within district)


def _jitter(base_lat: float, base_lng: float, seed: int) -> tuple[float, float]:
    """Deterministic spread around district center so facilities don't overlap."""
    rng = random.Random(seed)
    lat = base_lat + rng.uniform(-_PHC_JITTER_RADIUS, _PHC_JITTER_RADIUS)
    lng = base_lng + rng.uniform(-_PHC_JITTER_RADIUS, _PHC_JITTER_RADIUS)
    return round(lat, 5), round(lng, 5)


def _classify_risk(
    critical_meds: int,
    expiring_soon: int,
    total_items: int,
    min_days_to_stockout: float | None,
) -> tuple[str, str, float]:
    """Returns (color, label, score 0-1)."""
    score = 0.0

    if min_days_to_stockout is not None:
        if min_days_to_stockout <= 3:
            return "red", "Critical", 1.0
        elif min_days_to_stockout <= 7:
            score = max(score, 0.75)
        elif min_days_to_stockout <= 14:
            score = max(score, 0.50)

    if critical_meds >= 2:
        score = max(score, 0.85)
    elif critical_meds == 1:
        score = max(score, 0.55)

    if expiring_soon >= 3:
        return "purple", "Expiry/Overstock", max(score, 0.65)

    if score >= 0.80:
        return "red", "Critical", score
    elif score >= 0.60:
        return "orange", "High Risk", score
    elif score >= 0.35:
        return "yellow", "At Risk", score
    else:
        return "green", "Healthy", score


def get_map_data(db: Session, district_id: uuid.UUID | None = None) -> MapResponse:
    today = date.today()
    expiry_window = today + timedelta(days=90)
    critical_window = today + timedelta(days=7)

    # 1. Load facilities
    fac_query = select(Facility).where(Facility.status == "ACTIVE")
    if district_id:
        fac_query = fac_query.where(Facility.district_id == district_id)
    facilities = db.scalars(fac_query).all()

    # 2. Load districts for naming and center coord
    districts: dict[uuid.UUID, District] = {
        d.id: d for d in db.scalars(select(District)).all()
    }

    # 3. Collect pending/approved transfers
    transfers = db.scalars(
        select(StockTransfer).where(
            StockTransfer.status.in_(["PENDING", "APPROVED", "IN_TRANSIT"])
        )
    ).all()

    medicine_names: dict[uuid.UUID, str] = {
        m.id: m.name for m in db.scalars(select(Medicine)).all()
    }

    markers: list[FacilityMapMarker] = []
    color_summary: dict[str, int] = {
        "green": 0, "yellow": 0, "orange": 0, "red": 0, "purple": 0
    }

    for fac in facilities:
        district = districts.get(fac.district_id)
        dist_name = district.name if district else "Unknown"
        base_lat, base_lng = _DISTRICT_COORDS.get(dist_name, _DEFAULT_CENTER)

        # Assign coordinates — use stored ones if present, else jitter from district center
        if fac.latitude and fac.longitude:
            lat, lng = fac.latitude, fac.longitude
        else:
            # Use facility id integer hash for reproducible jitter
            seed = int(str(fac.id).replace("-", ""), 16) % (2**31)
            lat, lng = _jitter(base_lat, base_lng, seed)

        # ---- Risk calculation ----
        batches = db.scalars(
            select(InventoryBatch).where(InventoryBatch.facility_id == fac.id)
        ).all()

        total_stock = len(batches)
        expiring_soon = sum(1 for b in batches if b.expiry_date <= expiry_window)

        # Count medicines with low stock (< 7-day supply estimate)
        # We approximate: if any batch has quantity < avg daily consumption implied by 7 days
        # For simplicity: if quantity < 50 and expiry within 7 days → critical
        critical_meds = sum(
            1 for b in batches
            if b.quantity < 50 and b.expiry_date <= critical_window
        )

        # Pending transfers involving this facility
        pending_tx = sum(
            1 for t in transfers
            if t.destination_facility_id == fac.id or t.source_facility_id == fac.id
        )

        # Min days to stockout estimate: quantity / assumed 10 per day usage
        min_dts: float | None = None
        if batches:
            min_qty = min(b.quantity for b in batches)
            min_dts = min_qty / 10.0   # rough estimate

        color, label, score = _classify_risk(critical_meds, expiring_soon, total_stock, min_dts)
        color_summary[color] = color_summary.get(color, 0) + 1

        markers.append(
            FacilityMapMarker(
                id=fac.id,
                name=fac.name,
                facility_type=fac.facility_type,
                latitude=lat,
                longitude=lng,
                district_name=dist_name,
                risk_color=color,
                risk_label=label,
                risk_score=round(score, 3),
                total_stock_items=total_stock,
                critical_medicines=critical_meds,
                expiring_soon=expiring_soon,
                pending_transfers=pending_tx,
            )
        )

    # 4. Build transfer routes (only for facilities with known coords on both ends)
    fac_coord_map: dict[uuid.UUID, tuple[float, float]] = {
        m.id: (m.latitude, m.longitude) for m in markers
    }

    routes: list[TransferRoute] = []
    for t in transfers:
        src_id = t.source_facility_id
        dst_id = t.destination_facility_id
        if not src_id or not dst_id:
            continue
        if src_id not in fac_coord_map or dst_id not in fac_coord_map:
            continue

        src_lat, src_lng = fac_coord_map[src_id]
        dst_lat, dst_lng = fac_coord_map[dst_id]

        routes.append(
            TransferRoute(
                source_facility_id=src_id,
                destination_facility_id=dst_id,
                source_lat=src_lat,
                source_lng=src_lng,
                destination_lat=dst_lat,
                destination_lng=dst_lng,
                medicine_name=medicine_names.get(t.medicine_id, "Unknown Medicine"),
                quantity=t.quantity,
                status=t.status,
            )
        )

    # 5. Compute district center
    if markers:
        center_lat = sum(m.latitude for m in markers) / len(markers)
        center_lng = sum(m.longitude for m in markers) / len(markers)
    else:
        center_lat, center_lng = _DEFAULT_CENTER

    return MapResponse(
        markers=markers,
        transfer_routes=routes,
        district_center_lat=round(center_lat, 5),
        district_center_lng=round(center_lng, 5),
        summary=color_summary,
    )
