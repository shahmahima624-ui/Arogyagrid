import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
from app.schemas.ai import (
    CopilotQueryRequest,
    CopilotQueryResponse,
    RedistributionExplanationResponse,
)
from app.services import ai_service

router = APIRouter()


@router.post("/explain-redistribution/{recommendation_id}", response_model=RedistributionExplanationResponse)
def explain_redistribution(
    recommendation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates structured AI executive explanation for a specific redistribution recommendation.
    Uses Gemini AI if configured, otherwise falls back gracefully to deterministic rule-based explanation.
    """
    return ai_service.explain_redistribution_recommendation(db, recommendation_id)


@router.post("/copilot", response_model=CopilotQueryResponse)
def run_copilot(
    body: CopilotQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Interacts with AarogyaGrid Copilot for supply chain resilience questions.
    Uses live database context with Gemini or fallback rule engine.
    """
    effective_district = body.district_id or current_user.district_id
    return ai_service.ask_copilot(
        db=db,
        query=body.query,
        user=current_user,
        district_id=effective_district,
    )
