import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RedistributionExplanationResponse(BaseModel):
    recommendation_id: uuid.UUID
    executive_summary: str
    source_selection_rationale: str
    operational_impact: str
    risk_mitigation_plan: str
    model_used: str
    generated_at: datetime


class CopilotQueryRequest(BaseModel):
    query: str = Field(min_length=2, description="Natural language question regarding medicine resilience network")
    district_id: uuid.UUID | None = None


class CopilotQueryResponse(BaseModel):
    answer: str
    intent_detected: str = "GENERAL_SUMMARY"
    retrieved_facts: dict = Field(default_factory=dict)
    suggested_actions: list[str]
    data_context_summary: str
    model_used: str
    as_of: datetime

