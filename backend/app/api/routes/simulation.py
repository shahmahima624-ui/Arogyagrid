from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
from app.schemas.simulation import SimulationResultResponse, SimulationScenario
from app.services import simulation_service

router = APIRouter()


@router.post("/run", response_model=SimulationResultResponse)
def run_simulation(
    scenario: SimulationScenario,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes what-if stress simulation on supply chain:
    - Demand surge (+30%, +50%, epidemic outbreak)
    - Supply chain delay (+14 days)
    - Calculates accelerated stockout dates, emergency stock required, and preventive transfers
    """
    effective_district = scenario.district_id or current_user.district_id
    scenario.district_id = effective_district
    return simulation_service.run_stress_simulation(db=db, scenario=scenario)
