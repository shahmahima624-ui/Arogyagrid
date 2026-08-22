from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.seed import SeedDataResponse
from app.services import seed_service

router = APIRouter()


@router.post("/seed", response_model=SeedDataResponse)
def seed_demo_data(db: Session = Depends(get_db)):
    """
    Populates database with demo National Health Mission districts, facilities, medicines, stock batches, and 30-day consumption history.
    """
    return seed_service.seed_demo_database(db=db)
