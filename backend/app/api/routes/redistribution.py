import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import Facility, Medicine, RedistributionRecommendation, User, UserRole
from app.schemas.redistribution import (
    GenerateRedistributionRequest,
    GenerateRedistributionResponse,
    RedistributionRecommendationOut,
    ScoreBreakdown,
)
from app.services.redistribution_engine import (
    generate_redistribution_recommendations,
    get_recommendation_by_id,
    list_recommendations,
)

router = APIRouter()


def _to_out(rec: RedistributionRecommendation, db: Session) -> RedistributionRecommendationOut:
    """Hydrate DB record with facility/medicine names."""
    dest_fac = db.get(Facility, rec.destination_facility_id)
    med = db.get(Medicine, rec.medicine_id)

    src_fac = db.get(Facility, rec.source_facility_id) if rec.source_facility_id else None
    from app.models.core import Warehouse
    src_wh = db.get(Warehouse, rec.source_warehouse_id) if rec.source_warehouse_id else None

    breakdown = ScoreBreakdown(
        urgency_weight=rec.urgency_weight,
        surplus_weight=rec.surplus_weight,
        expiry_rescue_weight=rec.expiry_rescue_weight,
        impact_weight=rec.impact_weight,
        distance_penalty=rec.distance_penalty,
        source_risk_penalty=rec.source_risk_penalty,
        final_score=rec.score,
    )

    return RedistributionRecommendationOut(
        id=rec.id,
        destination_facility_id=rec.destination_facility_id,
        destination_facility_name=dest_fac.name if dest_fac else "Unknown",
        medicine_id=rec.medicine_id,
        medicine_name=med.name if med else "Unknown",
        category=med.category if med else "",
        unit=med.unit if med else "",
        status=rec.status,
        recommended_quantity=rec.recommended_quantity,
        source_facility_id=rec.source_facility_id,
        source_facility_name=src_fac.name if src_fac else None,
        source_facility_type=src_fac.facility_type if src_fac else None,
        source_warehouse_id=rec.source_warehouse_id,
        source_warehouse_name=src_wh.name if src_wh else None,
        distance_km=rec.distance_km,
        destination_days_to_stockout=rec.destination_days_to_stockout,
        source_safe_surplus=rec.source_safe_surplus,
        estimated_coverage_days_restored=rec.estimated_coverage_days_restored,
        reason=rec.reason,
        confidence=rec.confidence,
        score=rec.score,
        score_breakdown=breakdown,
        created_at=rec.created_at,
    )


@router.post("/generate", response_model=GenerateRedistributionResponse)
def generate_recommendations(
    body: GenerateRedistributionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Runs the Redistribution Engine against current stockout risks and surplus inventory.
    Persists ranked recommendations for human review.
    Only DISTRICT_ADMIN and WAREHOUSE_MANAGER may trigger generation.
    """
    if current_user.role not in [UserRole.DISTRICT_ADMIN, UserRole.WAREHOUSE_MANAGER]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only district admins or warehouse managers can generate recommendations.")

    effective_district = body.district_id
    effective_facility = body.facility_id
    if current_user.role == UserRole.FACILITY_ADMIN:
        effective_facility = current_user.facility_id

    created, scenarios = generate_redistribution_recommendations(
        db=db,
        district_id=effective_district,
        facility_id=effective_facility,
        top_n=body.top_n_per_shortage,
    )

    return GenerateRedistributionResponse(
        recommendations_created=created,
        scenarios_evaluated=scenarios,
        message=(
            f"Generated {created} recommendations across {scenarios} shortage scenarios."
            if scenarios > 0
            else "No shortage scenarios found within the urgency threshold. Network is currently healthy."
        ),
    )


@router.get("/recommendations", response_model=list[RedistributionRecommendationOut])
def get_recommendations(
    status: str | None = Query(None, description="Filter by status: RECOMMENDED, PENDING, APPROVED, REJECTED, CANCELLED"),
    facility_id: uuid.UUID | None = Query(None, description="Filter by destination facility"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all redistribution recommendations, ordered by score descending."""
    effective_facility = facility_id
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility = current_user.facility_id

    recs = list_recommendations(db, facility_id=effective_facility, status=status)
    return [_to_out(r, db) for r in recs]


@router.get("/{recommendation_id}", response_model=RedistributionRecommendationOut)
def get_recommendation(
    recommendation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a single redistribution recommendation by ID."""
    from fastapi import HTTPException
    rec = get_recommendation_by_id(db, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    return _to_out(rec, db)
