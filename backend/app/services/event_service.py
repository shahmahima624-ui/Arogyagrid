import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from app.schemas.telemetry import RealTimeEventMessage


async def event_generator() -> AsyncGenerator[str, None]:
    """Generates Server-Sent Events (SSE) stream for real-time dashboard updates."""
    counter = 0
    event_types = ["CRITICAL_STOCKOUT", "COLD_CHAIN_BREACH", "TRANSFER_APPROVED", "REPLENISHMENT_ARRIVED"]
    facilities = ["PHC Sanand Sector 1", "CHC Bavla Sector 2", "PHC Viramgam Sector 3"]

    while counter < 5:
        counter += 1
        ev_type = event_types[counter % len(event_types)]
        fac_name = facilities[counter % len(facilities)]

        msg = RealTimeEventMessage(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type=ev_type,
            title=f"{ev_type.replace('_', ' ')} Alert",
            details=f"Real-time supply event detected at {fac_name}.",
            timestamp=datetime.now(timezone.utc),
        )

        data = f"data: {json.dumps(msg.model_dump(), default=str)}\n\n"
        yield data
        await asyncio.sleep(1)
