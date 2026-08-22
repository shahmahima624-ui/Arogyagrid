import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User, UserRole
from app.schemas.expiry import ExpiryAssessmentResponse, ExpiryRescueOpportunity
from app.services.expiry_service import evaluate_expiry_risks

router = APIRouter()


@router.get("/risks", response_model=ExpiryAssessmentResponse)
def get_expiry_risks(
    district_id: uuid.UUID | None = Query(None, description="Filter by district"),
    facility_id: uuid.UUID | None = Query(None, description="Filter by facility"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns batch-level expiry calculations, urgency tiers, and rescue candidate flags."""
    effective_facility_id = facility_id
    effective_district_id = district_id

    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id

    return evaluate_expiry_risks(
        db=db,
        facility_id=effective_facility_id,
        district_id=effective_district_id,
    )


@router.get("/rescue-opportunities", response_model=list[ExpiryRescueOpportunity])
def get_expiry_rescue_opportunities(
    district_id: uuid.UUID | None = Query(None, description="Filter by district"),
    facility_id: uuid.UUID | None = Query(None, description="Filter by facility"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns prioritized candidate batches with safe surplus ready for FEFO redistribution."""
    effective_facility_id = facility_id
    effective_district_id = district_id

    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id

    assessment = evaluate_expiry_risks(
        db=db,
        facility_id=effective_facility_id,
        district_id=effective_district_id,
    )
    return assessment.rescue_opportunities
