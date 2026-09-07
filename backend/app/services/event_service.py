import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from app.schemas.telemetry import RealTimeEventMessage


async def event_generator() -> AsyncGenerator[str, None]:
    """
    Generates public, non-sensitive Server-Sent Events (SSE) telemetry heartbeats for real-time frontend indicators.
    Intentionally public: contains only generic network telemetry and status notices with NO sensitive facility,
    patient, medicine, or transfer details.
    """
    counter = 0
    system_notices = [
        ("GRID_HEARTBEAT", "Supply Network Telemetry Active", "Continuous cold chain & inventory telemetry streaming operational."),
        ("SYNC_CHECKPOINT", "Data Synchronization Checkpoint", "Network node status synchronization checkpoint completed successfully."),
        ("RESILIENCE_ONLINE", "Resilience Engine Online", "Geodesic optimization and forecasting models active on network grid."),
    ]

    while counter < 3:
        ev_type, title, details = system_notices[counter % len(system_notices)]
        counter += 1

        msg = RealTimeEventMessage(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type=ev_type,
            title=title,
            details=details,
            timestamp=datetime.now(timezone.utc),
        )

        data = f"data: {json.dumps(msg.model_dump(), default=str)}\n\n"
        yield data
        await asyncio.sleep(1)
