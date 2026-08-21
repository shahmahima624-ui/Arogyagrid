import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import Facility, Medicine, User, UserRole
from app.schemas.consumption_intelligence import ConsumptionIntelligenceOut
from app.services.consumption_intelligence_service import build_consumption_intelligence

router = APIRouter()


@router.get("/series", response_model=ConsumptionIntelligenceOut)
def get_consumption_series(
    facility_id: uuid.UUID,
    medicine_id: uuid.UUID,
    days: int = Query(default=90, ge=14, le=365),
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return an ordered, gap-filled series and deterministic demand features."""
    if db.get(Facility, facility_id) is None:
        raise HTTPException(status_code=404, detail="Facility not found")
    if db.get(Medicine, medicine_id) is None:
        raise HTTPException(status_code=404, detail="Medicine not found")
    if current_user.role == UserRole.WAREHOUSE_MANAGER.value:
        raise HTTPException(status_code=403, detail="Warehouse managers do not have access to consumption intelligence")
    if current_user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value) and current_user.facility_id != facility_id:
        raise HTTPException(status_code=403, detail="Access denied: you can only view your assigned facility")

    selected_end_date = end_date or date.today()
    return build_consumption_intelligence(
        db, facility_id, medicine_id, selected_end_date - timedelta(days=days - 1), selected_end_date
    )
