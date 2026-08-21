import uuid
from datetime import date

from pydantic import BaseModel, Field


class ConsumptionTimeSeriesPoint(BaseModel):
    """A daily, gap-filled consumption observation prepared for modelling."""

    date: date
    quantity_consumed: int = Field(ge=0)
    patient_count: int = Field(ge=0)
    lag_1: int | None = Field(default=None, ge=0)
    lag_7: int | None = Field(default=None, ge=0)
    lag_14: int | None = Field(default=None, ge=0)
    rolling_mean_7: float | None = Field(default=None, ge=0)
    rolling_mean_14: float | None = Field(default=None, ge=0)
    rolling_std_7: float | None = Field(default=None, ge=0)
    day_of_week: int = Field(ge=0, le=6)
    month: int = Field(ge=1, le=12)
    current_stock: int = Field(ge=0)


class ConsumptionIntelligenceSummary(BaseModel):
    facility_id: uuid.UUID
    medicine_id: uuid.UUID
    from_date: date
    to_date: date
    days_with_recorded_consumption: int = Field(ge=0)
    total_consumption: int = Field(ge=0)
    average_daily_demand: float = Field(ge=0)
    recent_7_day_average: float = Field(ge=0)
    previous_7_day_average: float = Field(ge=0)
    recent_demand_change_percent: float | None = None
    current_usable_stock: int = Field(ge=0)


class ConsumptionIntelligenceOut(BaseModel):
    summary: ConsumptionIntelligenceSummary
    series: list[ConsumptionTimeSeriesPoint]
