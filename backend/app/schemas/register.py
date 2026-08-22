import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RegisterRowDraft(BaseModel):
    """One row extracted from a paper medicine register."""
    medicine_name: str
    batch_number: str | None = None
    opening_stock: int | None = Field(default=None, ge=0)
    received_stock: int | None = Field(default=None, ge=0)
    consumed_stock: int | None = Field(default=None, ge=0)
    closing_stock: int | None = Field(default=None, ge=0)
    expiry_date: date | None = None
    medicine_id: uuid.UUID | None = None
    confidence_score: float = Field(default=0.88, ge=0.0, le=1.0)
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RegisterExtractionResponse(BaseModel):
    rows: list[RegisterRowDraft]
    model_used: str
    image_reference: str | None = None
    page_description: str | None = None
    extracted_fields: list[str] = ["medicine", "batch_number", "opening_stock", "received_stock", "consumed_stock", "closing_stock", "expiry_date"]


class RegisterSubmitRequest(BaseModel):
    facility_id: uuid.UUID
    verified_rows: list[RegisterRowDraft]
    image_reference: str | None = None
