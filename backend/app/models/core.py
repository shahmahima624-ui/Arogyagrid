import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.db.base import Base


class FacilityType(StrEnum):
    PHC = "PHC"
    CHC = "CHC"
    DISTRICT_HOSPITAL = "DISTRICT_HOSPITAL"


class UserRole(StrEnum):
    DISTRICT_ADMIN = "DISTRICT_ADMIN"
    FACILITY_ADMIN = "FACILITY_ADMIN"
    HEALTHCARE_STAFF = "HEALTHCARE_STAFF"
    WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER"


class TimestampedModel:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class District(TimestampedModel, Base):
    __tablename__ = "districts"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    state: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)


class Facility(TimestampedModel, Base):
    __tablename__ = "facilities"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("districts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    facility_type: Mapped[str] = mapped_column(String(40), nullable=False)
    address: Mapped[str | None] = mapped_column(String(300))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    contact_number: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)


class Warehouse(TimestampedModel, Base):
    __tablename__ = "warehouses"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    district_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("districts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    address: Mapped[str | None] = mapped_column(String(300))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)


class User(TimestampedModel, Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("facilities.id"))
    district_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("districts.id"))
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)


class Medicine(TimestampedModel, Base):
    __tablename__ = "medicines"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    generic_name: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(160))


class InventoryBatch(TimestampedModel, Base):
    __tablename__ = "inventory_batches"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_inventory_quantity_nonnegative"),
        CheckConstraint("(facility_id IS NOT NULL) != (warehouse_id IS NOT NULL)", name="ck_inventory_single_owner"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("facilities.id"))
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("warehouses.id"))
    medicine_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("medicines.id"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ConsumptionRecord(Base):
    __tablename__ = "consumption_records"
    __table_args__ = (CheckConstraint("quantity_consumed >= 0", name="ck_consumption_quantity_nonnegative"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("facilities.id"), nullable=False)
    medicine_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("medicines.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_consumed: Mapped[int] = mapped_column(Integer, nullable=False)
    patient_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("facilities.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RecommendationStatus(StrEnum):
    RECOMMENDED = "RECOMMENDED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class RedistributionRecommendation(TimestampedModel, Base):
    """Stores AI-generated redistribution recommendations for human approval."""
    __tablename__ = "redistribution_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Destination (shortage facility)
    destination_facility_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("facilities.id"), nullable=False)
    medicine_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("medicines.id"), nullable=False)

    # Source (surplus facility or warehouse)
    source_facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("facilities.id"))
    source_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("warehouses.id"))

    # Transfer details
    recommended_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=RecommendationStatus.RECOMMENDED, nullable=False)

    # Scoring metadata (transparent formula breakdown)
    score: Mapped[float] = mapped_column(nullable=False)
    urgency_weight: Mapped[float] = mapped_column(nullable=False)
    surplus_weight: Mapped[float] = mapped_column(nullable=False)
    expiry_rescue_weight: Mapped[float] = mapped_column(nullable=False)
    impact_weight: Mapped[float] = mapped_column(nullable=False)
    distance_penalty: Mapped[float] = mapped_column(nullable=False)
    source_risk_penalty: Mapped[float] = mapped_column(nullable=False)

    # Context
    distance_km: Mapped[float | None]
    destination_days_to_stockout: Mapped[float | None]
    source_safe_surplus: Mapped[int | None]
    estimated_coverage_days_restored: Mapped[float | None]
    reason: Mapped[str] = mapped_column(String(800), nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=False)  # 0.0 – 1.0


