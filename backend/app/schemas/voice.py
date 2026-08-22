import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VoiceTranscriptRequest(BaseModel):
    transcript: str = Field(min_length=2, description="Speech transcript or text representation in English, Hindi, or Hinglish")
    facility_id: uuid.UUID | None = None
    audio_base64: str | None = None


class ExtractedInventoryDraft(BaseModel):
    medicine_name: str
    medicine_id: uuid.UUID | None = None
    remaining_stock: int | None = Field(default=None, ge=0)
    consumed_today: int | None = Field(default=None, ge=0)
    batch_number: str | None = None
    confidence_score: float = Field(default=0.90, ge=0.0, le=1.0)
    language_detected: str = "Hinglish / English"
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VoiceExtractionResponse(BaseModel):
    drafts: list[ExtractedInventoryDraft]
    raw_transcript: str
    model_used: str
    extracted_at: datetime


class VoiceSubmitReportRequest(BaseModel):
    facility_id: uuid.UUID
    verified_items: list[ExtractedInventoryDraft]
