import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
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
    effective_district = district_id or current_user.district_id
    return map_service.get_map_data(db=db, district_id=effective_district)
