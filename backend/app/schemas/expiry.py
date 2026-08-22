import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

UrgencyTier = Literal["CRITICAL_30", "WARNING_60", "ATTENTION_90", "NORMAL"]
RescuePriority = Literal["HIGH", "MEDIUM", "LOW"]


class BatchExpiryRisk(BaseModel):
    batch_id: uuid.UUID
    batch_number: str
    facility_id: uuid.UUID | None = None
    facility_name: str | None = None
    warehouse_id: uuid.UUID | None = None
    warehouse_name: str | None = None
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    unit: str
    quantity: int
    expiry_date: date
    days_until_expiry: int
    expected_daily_consumption: float
    expected_consumption_before_expiry: int
    potential_expiring_surplus: int
    urgency: UrgencyTier
    is_rescue_candidate: bool
    recommended_action: str


class ExpiryRescueOpportunity(BaseModel):
    batch_id: uuid.UUID
    batch_number: str
    source_facility_id: uuid.UUID | None = None
    source_facility_name: str | None = None
    source_warehouse_id: uuid.UUID | None = None
    source_warehouse_name: str | None = None
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    unit: str
    batch_quantity: int
    expiry_date: date
    days_until_expiry: int
    expected_local_consumption: int
    rescueable_surplus: int
    priority: RescuePriority
    reason: str


class ExpiryEngineKPIs(BaseModel):
    total_batches_monitored: int
    expiring_soon_count: int  # <= 90 days
    total_expiring_units: int
    total_rescueable_surplus_units: int
    most_vulnerable_facility: str | None = None
    most_vulnerable_medicine: str | None = None


class ExpiryAssessmentResponse(BaseModel):
    kpis: ExpiryEngineKPIs
    batch_risks: list[BatchExpiryRisk]
    rescue_opportunities: list[ExpiryRescueOpportunity]
    as_of: datetime
