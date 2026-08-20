import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DistrictCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    state: str = Field(min_length=2, max_length=120)
    status: str = "ACTIVE"


class DistrictOut(DistrictCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class FacilityCreate(BaseModel):
    district_id: uuid.UUID
    name: str = Field(min_length=2, max_length=160)
    facility_type: str
    address: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    contact_number: str | None = None
    status: str = "ACTIVE"


class FacilityOut(FacilityCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class WarehouseCreate(BaseModel):
    district_id: uuid.UUID
    name: str = Field(min_length=2, max_length=160)
    address: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    status: str = "ACTIVE"


class WarehouseOut(WarehouseCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class MedicineCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    generic_name: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=100)
    unit: str = Field(min_length=1, max_length=50)
    manufacturer: str | None = None


class MedicineOut(MedicineCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class InventoryCreate(BaseModel):
    facility_id: uuid.UUID | None = None
    warehouse_id: uuid.UUID | None = None
    medicine_id: uuid.UUID
    batch_number: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=0)
    expiry_date: date

    @model_validator(mode="after")
    def has_one_owner(self):
        if (self.facility_id is None) == (self.warehouse_id is None):
            raise ValueError("Exactly one of facility_id or warehouse_id is required")
        return self


class InventoryOut(InventoryCreate, ORMModel):
    id: uuid.UUID
    received_at: datetime
    created_at: datetime
    updated_at: datetime


class ConsumptionCreate(BaseModel):
    facility_id: uuid.UUID
    medicine_id: uuid.UUID
    date: date
    quantity_consumed: int = Field(ge=0)
    patient_count: int | None = Field(default=None, ge=0)


class ConsumptionOut(ConsumptionCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
