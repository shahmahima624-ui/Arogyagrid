import uuid
from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, Field


class RiskTier(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH_RISK = "HIGH_RISK"
    AT_RISK = "AT_RISK"
    HEALTHY = "HEALTHY"


class StockoutRiskItem(BaseModel):
    facility_id: uuid.UUID
    facility_name: str
    facility_type: str
    district_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    current_usable_stock: int
    predicted_daily_demand: float
    days_to_stockout: float
    stockout_time_label: str
    projected_stockout_date: date | None = None
    risk_level: RiskTier
    safety_stock_required: int
    lead_time_days: int
    confidence_score: float
    recommended_action: str


class RiskSummaryKPIs(BaseModel):
    critical_count: int
    high_risk_count: int
    at_risk_count: int
    healthy_count: int
    most_vulnerable_facility: str | None = None
    most_vulnerable_medicine: str | None = None
    total_monitored_pairs: int


class RiskAssessmentResponse(BaseModel):
    kpis: RiskSummaryKPIs
    risks: list[StockoutRiskItem]
    as_of: datetime


class RecalculateRiskRequest(BaseModel):
    facility_id: uuid.UUID | None = None
    critical_threshold_days: float = Field(default=3.0, ge=1.0, le=10.0)
    high_risk_threshold_days: float = Field(default=7.0, ge=3.0, le=20.0)
    at_risk_threshold_days: float = Field(default=14.0, ge=7.0, le=30.0)


class RecalculateRiskResponse(BaseModel):
    status: str
    recalculated_items_count: int
    critical_risks_found: int
    high_risks_found: int
    message: str
    timestamp: datetime
