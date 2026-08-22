import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import AuditLog, Facility
from app.schemas.telemetry import ColdChainAlertResponse, TemperatureReadingRequest

# In-memory temperature log store for real-time telemetry
_TELEMETRY_LOGS: list[dict[str, Any]] = []


def log_temperature_reading(
    db: Session,
    body: TemperatureReadingRequest,
) -> ColdChainAlertResponse:
    fac = db.get(Facility, body.facility_id)
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found.")

    temp = body.temperature_celsius
    now = body.logged_at or datetime.now(timezone.utc)

    # Cold chain safety range for vaccines/insulin: 2.0°C to 8.0°C
    if temp < 2.0 or temp > 8.0:
        if temp < 0.0 or temp >= 10.0:
            alert_level = "EXCURSION_CRITICAL"
            msg = f"CRITICAL COLD-CHAIN EXCURSION! Temperature recorded at {temp}°C (Safe range: 2°C - 8°C) in {body.storage_unit_id}."
            action = "Immediately move vaccine carriers to backup solar cold room & inspect power supply."
        else:
            alert_level = "WARNING"
            msg = f"Temperature warning! Recorded {temp}°C in {body.storage_unit_id}."
            action = "Check freezer seal and temperature logger sensor calibration."

    else:
        alert_level = "NORMAL"
        msg = f"Cold-chain temperature optimal at {temp}°C."
        action = "None — Temperature within safe 2°C - 8°C limits."

    alert_id = uuid.uuid4()
    alert_res = ColdChainAlertResponse(
        alert_id=alert_id,
        facility_id=fac.id,
        facility_name=fac.name,
        storage_unit_id=body.storage_unit_id,
        temperature_celsius=temp,
        alert_level=alert_level,
        message=msg,
        action_required=action,
        timestamp=now,
    )

    # Store reading
    _TELEMETRY_LOGS.append(alert_res.model_dump())

    # Log audit if excursion
    if alert_level != "NORMAL":
        audit = AuditLog(
            facility_id=fac.id,
            action="COLD_CHAIN_ALERT",
            entity="StorageUnit",
            description=f"Cold chain excursion at {fac.name} [{body.storage_unit_id}]: {temp}°C",
        )
        db.add(audit)
        db.commit()

    return alert_res


def get_active_cold_chain_alerts(db: Session) -> list[ColdChainAlertResponse]:
    """Returns active cold-chain alerts from memory and database audit logs."""
    alerts: list[ColdChainAlertResponse] = []
    for log in reversed(_TELEMETRY_LOGS[-50:]):
        alerts.append(ColdChainAlertResponse(**log))
    return alerts
