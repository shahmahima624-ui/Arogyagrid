import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SimulationScenario(BaseModel):
    scenario_type: str = Field(default="DEMAND_SURGE", description="DEMAND_SURGE | EPIDEMIC_OUTBREAK | SUPPLY_DELAY | HEATWAVE_SURGE | CUSTOM")
    medicine_category: str | None = None
    medicine_id: uuid.UUID | None = None
    medicine_name_filter: str | None = None
    demand_increase_percentage: float = Field(default=30.0, ge=-50.0, le=500.0)
    supply_delay_days: int = Field(default=0, ge=0, le=180)
    district_id: uuid.UUID | None = None
    notes: str | None = None


class FacilitySimulationImpact(BaseModel):
    facility_id: uuid.UUID
    facility_name: str
    facility_type: str
    medicine_id: uuid.UUID
    medicine_name: str
    current_stock: int
    baseline_daily_demand: float
    simulated_daily_demand: float
    baseline_days_to_stockout: float
    simulated_days_to_stockout: float
    stockout_date_baseline: date
    stockout_date_simulated: date
    days_stockout_accelerated: int
    emergency_stock_required: int
    risk_level: str  # CRITICAL | HIGH | MEDIUM | STABLE

    model_config = ConfigDict(from_attributes=True)


class PreventiveTransferProposal(BaseModel):
    source_facility_id: uuid.UUID
    source_facility_name: str
    destination_facility_id: uuid.UUID
    destination_facility_name: str
    medicine_name: str
    recommended_transfer_qty: int
    prevents_stockout: bool


class SimulationSummary(BaseModel):
    total_facilities_affected: int
    facilities_newly_critical: int
    total_emergency_stock_needed: int
    avg_days_stockout_accelerated: float


class SimulationResultResponse(BaseModel):
    scenario: SimulationScenario
    executed_at: datetime
    summary: SimulationSummary
    facility_impacts: list[FacilitySimulationImpact]
    preventive_transfers: list[PreventiveTransferProposal]
    chart_data: list[dict[str, Any]]
