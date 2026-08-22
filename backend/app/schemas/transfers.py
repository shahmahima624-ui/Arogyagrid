import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TransferStatus = Literal["PENDING", "APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "CANCELLED"]


class TransferCreateFromRecommendation(BaseModel):
    recommendation_id: uuid.UUID
    notes: str | None = None


class TransferCreateManual(BaseModel):
    source_facility_id: uuid.UUID | None = None
    source_warehouse_id: uuid.UUID | None = None
    destination_facility_id: uuid.UUID
    medicine_id: uuid.UUID
    quantity: int = Field(gt=0, description="Quantity of medicine to transfer")
    notes: str | None = None


class TransferActionRequest(BaseModel):
    notes: str | None = None


class StockTransferOut(BaseModel):
    id: uuid.UUID
    tracking_number: str
    recommendation_id: uuid.UUID | None = None
    source_facility_id: uuid.UUID | None = None
    source_facility_name: str | None = None
    source_warehouse_id: uuid.UUID | None = None
    source_warehouse_name: str | None = None
    destination_facility_id: uuid.UUID
    destination_facility_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    unit: str
    quantity: int
    status: TransferStatus
    created_by_user_id: uuid.UUID | None = None
    created_by_user_name: str | None = None
    approved_by_user_id: uuid.UUID | None = None
    approved_by_user_name: str | None = None
    dispatched_at: datetime | None = None
    received_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
