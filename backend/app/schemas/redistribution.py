import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


RecommendationStatus = Literal["RECOMMENDED", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]


class ScoreBreakdown(BaseModel):
    urgency_weight: float = Field(description="Urgency component (0–1): destination days_to_stockout normalised")
    surplus_weight: float = Field(description="Source safe surplus magnitude (0–1)")
    expiry_rescue_weight: float = Field(description="Bonus when source batch is near expiry (0–1)")
    impact_weight: float = Field(description="Coverage days restored at destination (0–1)")
    distance_penalty: float = Field(description="Geographic distance penalty (0–1), higher = worse")
    source_risk_penalty: float = Field(description="Source facility stockout risk penalty (0–1)")
    final_score: float = Field(description="Composite score (urgency + surplus + expiry_rescue + impact) - (distance_penalty + source_risk_penalty)")


class RedistributionSource(BaseModel):
    source_facility_id: uuid.UUID | None = None
    source_facility_name: str | None = None
    source_facility_type: str | None = None
    source_warehouse_id: uuid.UUID | None = None
    source_warehouse_name: str | None = None
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    unit: str
    recommended_quantity: int
    source_safe_surplus: int
    distance_km: float | None
    score: float
    score_breakdown: ScoreBreakdown
    confidence: float
    destination_days_to_stockout: float | None
    estimated_coverage_days_restored: float | None
    reason: str


class RedistributionRecommendationOut(BaseModel):
    id: uuid.UUID
    destination_facility_id: uuid.UUID
    destination_facility_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    unit: str
    status: RecommendationStatus
    recommended_quantity: int
    source_facility_id: uuid.UUID | None = None
    source_facility_name: str | None = None
    source_facility_type: str | None = None
    source_warehouse_id: uuid.UUID | None = None
    source_warehouse_name: str | None = None
    distance_km: float | None = None
    destination_days_to_stockout: float | None = None
    source_safe_surplus: int | None = None
    estimated_coverage_days_restored: float | None = None
    reason: str
    confidence: float
    score: float
    score_breakdown: ScoreBreakdown
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class GenerateRedistributionRequest(BaseModel):
    district_id: uuid.UUID | None = None
    facility_id: uuid.UUID | None = None
    top_n_per_shortage: int = Field(default=3, ge=1, le=10, description="Top N sources per shortage scenario")


class GenerateRedistributionResponse(BaseModel):
    recommendations_created: int
    scenarios_evaluated: int
    message: str
