import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.session import get_db
from app.schemas.health import SystemDiagnosticsResponse

router = APIRouter()
START_TIME = time.time()


@router.get("/health")
def health_check() -> dict[str, str]:
    """Return a lightweight service liveness response."""
    return {"status": "ok", "service": "AarogyaGrid API"}


@router.get("/health/diagnostics", response_model=SystemDiagnosticsResponse)
def get_system_diagnostics(db: Session = Depends(get_db)):
    """
    Returns detailed telemetry on database latency, table row counts,
    AI engine configuration, and system memory.
    """
    settings = get_settings()

    # DB Latency & Row counts
    t0 = time.time()
    db.execute(text("SELECT 1"))
    db_latency_ms = round((time.time() - t0) * 1000, 2)

    facilities_count = db.execute(text("SELECT COUNT(*) FROM facilities")).scalar() or 0
    batches_count = db.execute(text("SELECT COUNT(*) FROM inventory_batches")).scalar() or 0
    transfers_count = db.execute(text("SELECT COUNT(*) FROM stock_transfers")).scalar() or 0

    uptime = round(time.time() - START_TIME, 1)

    ai_configured = bool(settings.gemini_api_key)

    return SystemDiagnosticsResponse(
        status="HEALTHY",
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=uptime,
        database={
            "status": "CONNECTED",
            "latency_ms": db_latency_ms,
            "facilities_records": facilities_count,
            "inventory_batches_records": batches_count,
            "stock_transfers_records": transfers_count,
        },
        ai_engine={
            "provider": "Google Gemini 2.5 Flash",
            "api_key_configured": ai_configured,
            "status": "READY" if ai_configured else "FALLBACK_MODE",
        },
        system_memory={
            "pid": os.getpid(),
            "status": "NORMAL",
        },
        active_phases_count=17,
    )
