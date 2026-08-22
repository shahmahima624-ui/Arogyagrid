from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.event_service import event_generator

router = APIRouter()


@router.get("/stream")
def stream_realtime_events():
    """
    Server-Sent Events (SSE) stream endpoint pushing live alerts (critical stockouts, cold-chain breaches) to frontend clients.
    """
    return StreamingResponse(event_generator(), media_type="text/event-stream")
