from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
from app.schemas.voice import (
    VoiceExtractionResponse,
    VoiceSubmitReportRequest,
    VoiceTranscriptRequest,
)
from app.services import voice_service

router = APIRouter()


@router.post("/process-transcript", response_model=VoiceExtractionResponse)
def process_transcript(
    body: VoiceTranscriptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Parses voice transcript (Hindi, Hinglish, English) into structured inventory draft.
    Does NOT save directly to inventory; requires human verification.
    """
    effective_facility = body.facility_id or current_user.facility_id
    return voice_service.process_voice_transcript(
        db=db,
        transcript=body.transcript,
        facility_id=effective_facility,
    )


@router.post("/submit-report")
def submit_verified_report(
    body: VoiceSubmitReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Reconciles human-verified voice report items into live database inventory & consumption records.
    """
    return voice_service.submit_voice_report(
        db=db,
        body=body,
        user=current_user,
    )
