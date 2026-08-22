import uuid
from datetime import datetime, timezone
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import ConsumptionRecord, Facility, InventoryBatch, Medicine, User, UserRole
from app.schemas.forecasts import (
    FacilityMedicineForecastDetail,
    GenerateForecastRequest,
    GenerateForecastResponse,
    MedicineForecastSummary,
    RollingAverageAnalytics,
)
from app.services.forecasting import (
    compute_consumption_analytics,
    train_and_forecast_item,
)
from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("", response_model=list[MedicineForecastSummary])
def list_forecasts(
    district_id: uuid.UUID | None = Query(None, description="Filter by district"),
    facility_id: uuid.UUID | None = Query(None, description="Filter by facility"),
    category: str | None = Query(None, description="Filter by medicine category"),
    search: str | None = Query(None, description="Search medicine or facility name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns demand forecast summaries across facility-medicine pairs."""
    # Apply role scoping
    effective_facility_id = facility_id
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id

    # Fetch facilities
    fac_query = select(Facility)
    if effective_facility_id:
        fac_query = fac_query.where(Facility.id == effective_facility_id)
    elif district_id:
        fac_query = fac_query.where(Facility.district_id == district_id)
    facilities = db.scalars(fac_query).all()
    facility_map = {f.id: f for f in facilities}

    # Fetch medicines
    med_query = select(Medicine)
    if category:
        med_query = med_query.where(Medicine.category == category)
    medicines = db.scalars(med_query).all()

    # Fetch active stocks
    batches = db.scalars(select(InventoryBatch)).all()
    stocks = defaultdict(int)
    for b in batches:
        if b.facility_id:
            stocks[(b.facility_id, b.medicine_id)] += b.quantity

    # Fetch consumption records
    consumptions = db.scalars(select(ConsumptionRecord)).all()
    records_by_pair = defaultdict(list)
    for c in consumptions:
        records_by_pair[(c.facility_id, c.medicine_id)].append(c)

    summaries: list[MedicineForecastSummary] = []

    for fac in facilities:
        for med in medicines:
            if search:
                query_lower = search.lower()
                if query_lower not in med.name.lower() and query_lower not in fac.name.lower():
                    continue

            curr_stock = stocks[(fac.id, med.id)]
            recs = records_by_pair[(fac.id, med.id)]

            summary, _ = train_and_forecast_item(
                facility_id=fac.id,
                facility_name=fac.name,
                medicine_id=med.id,
                medicine_name=med.name,
                category=med.category,
                current_stock=curr_stock,
                consumption_records=recs,
                horizon_days=14,
            )
            summaries.append(summary)

    # Sort by stockout risk (shortest days first)
    summaries.sort(key=lambda x: (x.days_to_stockout is None, x.days_to_stockout or 999))
    return summaries


@router.post("/generate", response_model=GenerateForecastResponse)
def generate_forecasts(
    payload: GenerateForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN, UserRole.FACILITY_ADMIN])),
):
    """Triggers ML model training and forecast regeneration across network nodes."""
    target_facility_id = payload.facility_id or (
        current_user.facility_id if current_user.role == UserRole.FACILITY_ADMIN else None
    )

    fac_query = select(Facility)
    if target_facility_id:
        fac_query = fac_query.where(Facility.id == target_facility_id)
    facilities = db.scalars(fac_query).all()

    medicines = db.scalars(select(Medicine)).all()

    batches = db.scalars(select(InventoryBatch)).all()
    stocks = defaultdict(int)
    for b in batches:
        if b.facility_id:
            stocks[(b.facility_id, b.medicine_id)] += b.quantity

    consumptions = db.scalars(select(ConsumptionRecord)).all()
    records_by_pair = defaultdict(list)
    for c in consumptions:
        records_by_pair[(c.facility_id, c.medicine_id)].append(c)

    total_generated = 0
    mapes = []
    maes = []

    for fac in facilities:
        for med in medicines:
            curr_stock = stocks[(fac.id, med.id)]
            recs = records_by_pair[(fac.id, med.id)]

            summary, detail = train_and_forecast_item(
                facility_id=fac.id,
                facility_name=fac.name,
                medicine_id=med.id,
                medicine_name=med.name,
                category=med.category,
                current_stock=curr_stock,
                consumption_records=recs,
                horizon_days=payload.horizon_days,
            )
            total_generated += 1
            mapes.append(summary.mape)
            maes.append(detail.metrics.mae)

    # Filter out None values — EMA fallback path returns null metrics
    valid_mapes = [m for m in mapes if m is not None]
    valid_maes = [m for m in maes if m is not None]
    avg_mape = round(float(sum(valid_mapes) / max(len(valid_mapes), 1)), 1) if valid_mapes else 0.0
    avg_mae = round(float(sum(valid_maes) / max(len(valid_maes), 1)), 2) if valid_maes else 0.0

    return GenerateForecastResponse(
        status="SUCCESS",
        forecasts_generated_count=total_generated,
        average_mape=avg_mape,
        average_mae=avg_mae,
        message=f"Successfully trained ML models and generated {total_generated} forecast horizons with {payload.horizon_days}d window.",
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/analytics/consumption", response_model=list[RollingAverageAnalytics])
def get_consumption_analytics_endpoint(
    facility_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phase 4 endpoint: Returns rolling averages, trends, and stock velocity."""
    effective_facility_id = facility_id
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id

    return compute_consumption_analytics(db, effective_facility_id)


@router.get("/{facility_id}/{medicine_id}", response_model=FacilityMedicineForecastDetail)
def get_forecast_detail(
    facility_id: uuid.UUID,
    medicine_id: uuid.UUID,
    horizon_days: int = Query(14, ge=7, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns detailed historical consumption points, predicted trajectory, and model evaluation metrics."""
    # Scope check
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        if current_user.facility_id and current_user.facility_id != facility_id:
            raise HTTPException(status_code=403, detail="Access to facility forecast is forbidden")

    facility = db.get(Facility, facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    medicine = db.get(Medicine, medicine_id)
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")

    # Current stock
    batches = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.facility_id == facility_id,
            InventoryBatch.medicine_id == medicine_id,
        )
    ).all()
    curr_stock = sum(b.quantity for b in batches)

    # Consumption records
    recs = db.scalars(
        select(ConsumptionRecord).where(
            ConsumptionRecord.facility_id == facility_id,
            ConsumptionRecord.medicine_id == medicine_id,
        )
    ).all()

    _, detail = train_and_forecast_item(
        facility_id=facility.id,
        facility_name=facility.name,
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        category=medicine.category,
        current_stock=curr_stock,
        consumption_records=recs,
        horizon_days=horizon_days,
    )

    return detail
