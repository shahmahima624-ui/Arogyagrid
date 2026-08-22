import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import User, UserRole
from app.schemas.risks import (
    RecalculateRiskRequest,
    RecalculateRiskResponse,
    RiskAssessmentResponse,
    RiskTier,
    StockoutRiskItem,
)
from app.services.risk_engine import evaluate_stockout_risks
from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("", response_model=RiskAssessmentResponse)
def get_stockout_risks(
    risk_level: RiskTier | None = Query(None, description="Filter by risk tier (CRITICAL, HIGH_RISK, etc.)"),
    district_id: uuid.UUID | None = Query(None, description="Filter by district"),
    facility_id: uuid.UUID | None = Query(None, description="Filter by facility"),
    category: str | None = Query(None, description="Filter by medicine category"),
    search: str | None = Query(None, description="Search by medicine or facility name"),
    critical_threshold: float = Query(3.0, ge=1.0, le=10.0, description="Critical risk cutoff in days"),
    high_risk_threshold: float = Query(7.0, ge=3.0, le=20.0, description="High risk cutoff in days"),
    at_risk_threshold: float = Query(14.0, ge=7.0, le=30.0, description="At risk cutoff in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns dynamic stock-out risk calculations across facility-medicine pairs."""
    effective_facility_id = facility_id
    effective_district_id = district_id

    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id

    assessment = evaluate_stockout_risks(
        db=db,
        facility_id=effective_facility_id,
        district_id=effective_district_id,
        critical_threshold_days=critical_threshold,
        high_risk_threshold_days=high_risk_threshold,
        at_risk_threshold_days=at_risk_threshold,
    )

    # Apply in-memory filters for category, risk_level, search
    filtered_risks = assessment.risks
    if risk_level:
        filtered_risks = [r for r in filtered_risks if r.risk_level == risk_level]
    if category:
        filtered_risks = [r for r in filtered_risks if r.category.lower() == category.lower()]
    if search:
        query_lower = search.lower()
        filtered_risks = [
            r
            for r in filtered_risks
            if query_lower in r.medicine_name.lower() or query_lower in r.facility_name.lower()
        ]

    return RiskAssessmentResponse(
        kpis=assessment.kpis,
        risks=filtered_risks,
        as_of=assessment.as_of,
    )


@router.get("/critical", response_model=list[StockoutRiskItem])
def get_critical_stockout_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fast-path endpoint returning only CRITICAL stockout risks."""
    effective_facility_id = None
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id

    assessment = evaluate_stockout_risks(
        db=db,
        facility_id=effective_facility_id,
    )
    return [r for r in assessment.risks if r.risk_level == RiskTier.CRITICAL]


@router.post("/recalculate", response_model=RecalculateRiskResponse)
def recalculate_stockout_risks(
    payload: RecalculateRiskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN, UserRole.FACILITY_ADMIN])),
):
    """Triggers on-demand stockout risk re-evaluation."""
    target_facility_id = payload.facility_id
    if current_user.role == UserRole.FACILITY_ADMIN:
        target_facility_id = current_user.facility_id

    assessment = evaluate_stockout_risks(
        db=db,
        facility_id=target_facility_id,
        critical_threshold_days=payload.critical_threshold_days,
        high_risk_threshold_days=payload.high_risk_threshold_days,
        at_risk_threshold_days=payload.at_risk_threshold_days,
    )

    return RecalculateRiskResponse(
        status="SUCCESS",
        recalculated_items_count=assessment.kpis.total_monitored_pairs,
        critical_risks_found=assessment.kpis.critical_count,
        high_risks_found=assessment.kpis.high_risk_count,
        message=f"Stockout risk evaluation complete. Identified {assessment.kpis.critical_count} critical and {assessment.kpis.high_risk_count} high-risk nodes.",
        timestamp=datetime.now(timezone.utc),
    )
