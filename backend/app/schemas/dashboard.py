import uuid
from datetime import date, datetime
from pydantic import BaseModel


class CommandCenterKPIs(BaseModel):
    total_facilities: int
    total_medicines: int
    total_inventory_units: int
    low_stock_items_count: int
    expiring_soon_count: int
    critical_facilities_count: int
    pending_transfers_count: int


class FacilityHealthItem(BaseModel):
    id: uuid.UUID
    name: str
    facility_type: str
    district_name: str
    total_stock: int
    low_stock_count: int
    expiring_count: int
    status: str  # "CRITICAL", "WARNING", "NORMAL"
    last_consumption_date: str | None = None


class ExpiryAlertItem(BaseModel):
    batch_id: uuid.UUID
    batch_number: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    quantity: int
    expiry_date: date
    days_remaining: int
    urgency: str  # "CRITICAL_30", "WARNING_60", "ATTENTION_90"
    facility_id: uuid.UUID | None = None
    facility_name: str | None = None
    warehouse_id: uuid.UUID | None = None
    warehouse_name: str | None = None


class StockAlertItem(BaseModel):
    facility_id: uuid.UUID
    facility_name: str
    medicine_id: uuid.UUID
    medicine_name: str
    category: str
    current_stock: int
    reorder_level: int
    status: str  # "OUT_OF_STOCK", "LOW_STOCK", "ADEQUATE"


class CategoryStockItem(BaseModel):
    category: str
    total_units: int
    batch_count: int
    medicine_count: int


class ActivityFeedItem(BaseModel):
    id: str
    timestamp: datetime
    event_type: str  # "AUDIT", "CONSUMPTION", "INVENTORY"
    actor_name: str
    description: str
    facility_name: str | None = None


class CommandCenterResponse(BaseModel):
    kpis: CommandCenterKPIs
    facility_health: list[FacilityHealthItem]
    expiry_alerts: list[ExpiryAlertItem]
    stock_alerts: list[StockAlertItem]
    category_distribution: list[CategoryStockItem]
    recent_activity: list[ActivityFeedItem]
    as_of: datetime
