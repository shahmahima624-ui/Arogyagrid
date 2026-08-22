from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.telemetry import ColdChainAlertResponse, TemperatureReadingRequest
from app.services import telemetry_service

router = APIRouter()


@router.post("/log-temperature", response_model=ColdChainAlertResponse)
def log_temperature(
    body: TemperatureReadingRequest,
    db: Session = Depends(get_db),
):
    """
    Logs cold-chain storage unit temperature reading (2.0°C to 8.0°C range).
    Detects temperature excursion breaches and returns emergency alert response.
    """
    return telemetry_service.log_temperature_reading(db=db, body=body)


@router.get("/alerts", response_model=list[ColdChainAlertResponse])
def get_cold_chain_alerts(
    db: Session = Depends(get_db),
):
    """
    Returns active cold-chain temperature excursion alerts.
    """
    return telemetry_service.get_active_cold_chain_alerts(db=db)
