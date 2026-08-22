import uuid
from pydantic import BaseModel, ConfigDict


class FacilityMapMarker(BaseModel):
    """Facility enriched with risk status for map visualization."""
    id: uuid.UUID
    name: str
    facility_type: str
    latitude: float
    longitude: float
    district_name: str

    # Risk classification
    risk_color: str           # "green" | "yellow" | "orange" | "red" | "purple"
    risk_label: str           # "Healthy" | "At Risk" | "High Risk" | "Critical" | "Expiry/Overstock"
    risk_score: float         # 0.0 – 1.0

    # Context stats
    total_stock_items: int
    critical_medicines: int
    expiring_soon: int
    pending_transfers: int

    model_config = ConfigDict(from_attributes=True)


class TransferRoute(BaseModel):
    """Represents a transfer route drawn as a line between two facilities."""
    source_facility_id: uuid.UUID
    destination_facility_id: uuid.UUID
    source_lat: float
    source_lng: float
    destination_lat: float
    destination_lng: float
    medicine_name: str
    quantity: int
    status: str           # PENDING | APPROVED | IN_TRANSIT


class MapResponse(BaseModel):
    markers: list[FacilityMapMarker]
    transfer_routes: list[TransferRoute]
    district_center_lat: float
    district_center_lng: float
    summary: dict[str, int]   # count by risk_color
