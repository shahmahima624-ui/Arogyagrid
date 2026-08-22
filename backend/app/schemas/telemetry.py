import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class TemperatureReadingRequest(BaseModel):
    facility_id: uuid.UUID
    storage_unit_id: str = Field(default="FREEZER-01", description="Identifier of cold room, freezer, or vaccine carrier")
    temperature_celsius: float = Field(..., description="Target range: 2.0°C to 8.0°C")
    humidity_percent: float = Field(default=45.0, ge=0.0, le=100.0)
    power_status: str = "GRID_MAINS"  # GRID_MAINS | SOLAR | BATTERY | GENERATOR
    logged_at: datetime | None = None


class ColdChainAlertResponse(BaseModel):
    alert_id: uuid.UUID
    facility_id: uuid.UUID
    facility_name: str
    storage_unit_id: str
    temperature_celsius: float
    alert_level: str  # NORMAL | WARNING | EXCURSION_CRITICAL
    message: str
    action_required: str
    timestamp: datetime


class RealTimeEventMessage(BaseModel):
    event_id: str
    event_type: str  # CRITICAL_STOCKOUT | COLD_CHAIN_BREACH | TRANSFER_APPROVED | REACTION_ALERT
    facility_id: uuid.UUID | None = None
    title: str
    details: str
    timestamp: datetime
