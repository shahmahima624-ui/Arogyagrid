from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
from app.schemas.register import RegisterExtractionResponse, RegisterSubmitRequest
from app.services import register_service

router = APIRouter()


class RegisterImageRequest(BaseModel):
    image_base64: str | None = None
    image_reference: str | None = None


@router.post("/extract", response_model=RegisterExtractionResponse)
def extract_register_image(
    body: RegisterImageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts a base64-encoded medicine register image (JPEG/PNG).
    Uses Gemini multimodal to extract: medicine, batch, opening/received/consumed/closing stock, expiry.
    Returns structured draft — does NOT save to DB yet (human verification required).
    """
    return register_service.extract_register_image(
        db=db,
        image_base64=body.image_base64,
        image_reference=body.image_reference,
    )


@router.post("/submit")
def submit_register_report(
    body: RegisterSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Reconciles human-verified register rows into live DB inventory batches.
    """
    return register_service.submit_register_report(
        db=db,
        body=body,
        user=current_user,
    )
