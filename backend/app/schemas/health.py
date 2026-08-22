from datetime import datetime
from typing import Any
from pydantic import BaseModel


class SystemDiagnosticsResponse(BaseModel):
    status: str = "HEALTHY"
    timestamp: datetime
    uptime_seconds: float
    database: dict[str, Any]
    ai_engine: dict[str, Any]
    system_memory: dict[str, Any]
    active_phases_count: int = 17
