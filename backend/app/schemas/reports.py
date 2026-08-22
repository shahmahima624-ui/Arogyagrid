import uuid
from datetime import date, datetime
from pydantic import BaseModel


class DispatchManifestResponse(BaseModel):
    transfer_id: uuid.UUID
    tracking_number: str
    issued_at: datetime
    government_header: str = "GOVERNMENT OF INDIA — NATIONAL HEALTH MISSION"
    district_name: str
    source_facility_name: str
    source_address: str | None = None
    destination_facility_name: str
    destination_address: str | None = None
    medicine_name: str
    generic_name: str
    unit: str
    quantity: int
    batch_number: str | None = None
    expiry_date: date | None = None
    status: str
    transport_mode: str = "Government Cold-Chain Courier / Ambulance Dispatch"
    authorized_by: str = "District Supply Chain Officer"
    security_hash: str
