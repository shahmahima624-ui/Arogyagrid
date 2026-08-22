import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field


class DailyConsumptionPoint(BaseModel):
    date: date
    quantity: int
    patient_count: int | None = None
    rolling_7d_avg: float | None = None


class ForecastPoint(BaseModel):
    date: date
    predicted_quantity: float
    lower_bound: float
    upper_bound: float


class ModelEvaluationMetrics(BaseModel):
    model_name: str
    evaluation_available: bool = True  # False when insufficient data for held-out evaluation
    mae: float | None = None           # Mean Absolute Error
    rmse: float | None = None          # Root Mean Squared Error
    mape: float | None = None          # Mean Absolute Percentage Error (%)
    r2_score: float | None = None
    sample_count: int
    training_date: datetime


class RollingAverageAnalytics(BaseModel):
    facility_id: uuid.UUID
    facility_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    current_stock: int
    avg_daily_7d: float
    avg_daily_14d: float
    avg_daily_30d: float
    weekly_trend_pct: float
    days_of_stock_remaining: float | None = None


class MedicineForecastSummary(BaseModel):
    facility_id: uuid.UUID
    facility_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    current_stock: int
    avg_daily_historical: float
    predicted_daily_demand: float
    predicted_7d_demand: float
    predicted_14d_demand: float
    predicted_30d_demand: float
    confidence_score: float
    model_name: str
    mape: float | None = None
    days_to_stockout: float | None = None


class FacilityMedicineForecastDetail(BaseModel):
    facility_id: uuid.UUID
    facility_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    current_stock: int
    historical_points: list[DailyConsumptionPoint]
    forecast_points: list[ForecastPoint]
    metrics: ModelEvaluationMetrics
    predicted_daily_demand: float
    avg_daily_historical: float
    confidence_score: float
    horizon_days: int


class GenerateForecastRequest(BaseModel):
    horizon_days: int = Field(default=14, ge=7, le=60)
    facility_id: uuid.UUID | None = None
    model_type: str = Field(default="auto", description="auto, gradient_boosting, or moving_average")


class GenerateForecastResponse(BaseModel):
    status: str
    forecasts_generated_count: int
    average_mape: float
    average_mae: float
    message: str
    timestamp: datetime
