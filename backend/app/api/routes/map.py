import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_scope
from app.db.session import get_db
from app.models.core import User, UserRole, Facility
from app.schemas.map import MapResponse
from app.services import map_service

router = APIRouter()


@router.get("/facilities", response_model=MapResponse)
def get_map_facilities(
    district_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all active facilities with:
    - Geo coordinates (lat/lng)
    - Risk color classification (green/yellow/orange/red/purple)
    - Transfer routes between source/destination facilities
    - District-level summary counts
    """
    # Derive user's authorized district scope
    user_district_id = current_user.district_id
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF] and current_user.facility_id:
        user_facility = db.get(Facility, current_user.facility_id)
        if user_facility:
            user_district_id = user_facility.district_id

    # Strictly reject requests targeting foreign districts
    if district_id and user_district_id and district_id != user_district_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot access map data outside your assigned district",
        )

    effective_district = user_district_id
    return map_service.get_map_data(db=db, district_id=effective_district)
