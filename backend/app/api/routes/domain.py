import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, Warehouse, User, UserRole, AuditLog
from app.schemas.core import (
    ConsumptionCreate,
    ConsumptionOut,
    DistrictCreate,
    DistrictOut,
    FacilityCreate,
    FacilityOut,
    InventoryCreate,
    InventoryOut,
    MedicineCreate,
    MedicineOut,
    WarehouseCreate,
    WarehouseOut,
)
from app.core.dependencies import get_current_user, require_role, verify_scope

router = APIRouter()


def require(db: Session, model: type, entity_id: uuid.UUID, label: str):
    entity = db.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return entity


def log_audit(db: Session, user: User, action: str, entity: str, entity_id: uuid.UUID | None, description: str, facility_id: uuid.UUID | None = None) -> None:
    """Helper to log mutations to the AuditLog table."""
    audit = AuditLog(
        user_id=user.id,
        facility_id=facility_id or user.facility_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        description=description
    )
    db.add(audit)
    db.commit()


# --- Districts ---

@router.get("/districts", response_model=list[DistrictOut])
def list_districts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.scalars(select(District).order_by(District.name)).all()


@router.post("/districts", response_model=DistrictOut, status_code=status.HTTP_201_CREATED)
def create_district(
    payload: DistrictCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN]))
):
    entity = District(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    log_audit(db, current_user, "CREATE", "DISTRICT", entity.id, f"Created district: {entity.name}")
    return entity


# --- Facilities ---

@router.get("/facilities", response_model=list[FacilityOut])
def list_facilities(
    district_id: uuid.UUID | None = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Facility).order_by(Facility.name)
    if district_id:
        query = query.where(Facility.district_id == district_id)
    return db.scalars(query).all()


@router.post("/facilities", response_model=FacilityOut, status_code=status.HTTP_201_CREATED)
def create_facility(
    payload: FacilityCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN]))
):
    require(db, District, payload.district_id, "District")
    entity = Facility(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    log_audit(db, current_user, "CREATE", "FACILITY", entity.id, f"Created facility: {entity.name}", entity.id)
    return entity


# --- Warehouses ---

@router.get("/warehouses", response_model=list[WarehouseOut])
def list_warehouses(
    district_id: uuid.UUID | None = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Warehouse).order_by(Warehouse.name)
    if district_id:
        query = query.where(Warehouse.district_id == district_id)
    return db.scalars(query).all()


@router.post("/warehouses", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN]))
):
    require(db, District, payload.district_id, "District")
    entity = Warehouse(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    log_audit(db, current_user, "CREATE", "WAREHOUSE", entity.id, f"Created warehouse: {entity.name}")
    return entity


# --- Medicines ---

@router.get("/medicines", response_model=list[MedicineOut])
def list_medicines(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.scalars(select(Medicine).order_by(Medicine.name)).all()


@router.post("/medicines", response_model=MedicineOut, status_code=status.HTTP_201_CREATED)
def create_medicine(
    payload: MedicineCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN]))
):
    entity = Medicine(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    log_audit(db, current_user, "CREATE", "MEDICINE", entity.id, f"Created medicine: {entity.name}")
    return entity


# --- Inventory ---

@router.get("/inventory", response_model=list[InventoryOut])
def list_inventory(
    facility_id: uuid.UUID | None = None,
    medicine_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(InventoryBatch).order_by(InventoryBatch.expiry_date)
    
    # Enforce RBAC Scoping
    if current_user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
        # Force/check facility_id
        if facility_id and facility_id != current_user.facility_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you can only view inventory for your assigned facility."
            )
        facility_id = current_user.facility_id
        query = query.where(InventoryBatch.facility_id == facility_id)
        
    elif current_user.role == UserRole.WAREHOUSE_MANAGER.value:
        # Warehouse manager can only view warehouse inventory
        if facility_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: warehouse managers cannot view facility inventory."
            )
        # Find warehouse for this district
        warehouse = db.scalar(select(Warehouse).where(Warehouse.district_id == current_user.district_id))
        warehouse_id = warehouse.id if warehouse else None
        if not warehouse_id:
            return []
        query = query.where(InventoryBatch.warehouse_id == warehouse_id)
        
    else:
        # District admins see everything; optionally apply standard filters
        if facility_id:
            query = query.where(InventoryBatch.facility_id == facility_id)
            
    if medicine_id:
        query = query.where(InventoryBatch.medicine_id == medicine_id)
        
    return db.scalars(query).all()


@router.post("/inventory", response_model=InventoryOut, status_code=status.HTTP_201_CREATED)
def add_inventory(
    payload: InventoryCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.expiry_date <= date.today():
        raise HTTPException(status_code=422, detail="expiry_date must be in the future")
        
    medicine = require(db, Medicine, payload.medicine_id, "Medicine")
    
    # Enforce scope
    verify_scope(current_user, payload.facility_id, payload.warehouse_id, db)
    
    # Additional validation to ensure warehouse manager uses their warehouse ID
    if current_user.role == UserRole.WAREHOUSE_MANAGER.value:
        warehouse = db.scalar(select(Warehouse).where(Warehouse.district_id == current_user.district_id))
        warehouse_id = warehouse.id if warehouse else None
        if not warehouse_id or payload.warehouse_id != warehouse_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: warehouse managers can only add inventory to their own district warehouse."
            )

    batch = InventoryBatch(**payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    log_audit(
        db, 
        current_user, 
        "CREATE", 
        "INVENTORY_BATCH", 
        batch.id, 
        f"Added batch {batch.batch_number} of {medicine.name} (qty: {batch.quantity})",
        batch.facility_id
    )
    return batch


# --- Consumption ---

@router.get("/consumption", response_model=list[ConsumptionOut])
def list_consumption(
    facility_id: uuid.UUID | None = None,
    medicine_id: uuid.UUID | None = None,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Warehouse managers cannot see consumption
    if current_user.role == UserRole.WAREHOUSE_MANAGER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: warehouse managers do not have access to consumption records."
        )

    query = select(ConsumptionRecord).order_by(ConsumptionRecord.date.desc())
    
    # Enforce scope
    if current_user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
        if facility_id and facility_id != current_user.facility_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you can only view consumption records for your assigned facility."
            )
        facility_id = current_user.facility_id
        
    if facility_id:
        query = query.where(ConsumptionRecord.facility_id == facility_id)
    if medicine_id:
        query = query.where(ConsumptionRecord.medicine_id == medicine_id)
    if from_date:
        query = query.where(ConsumptionRecord.date >= from_date)
    if to_date:
        query = query.where(ConsumptionRecord.date <= to_date)
        
    return db.scalars(query).all()


@router.post("/consumption", response_model=ConsumptionOut, status_code=status.HTTP_201_CREATED)
def record_consumption(
    payload: ConsumptionCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF, UserRole.DISTRICT_ADMIN]))
):
    medicine = require(db, Medicine, payload.medicine_id, "Medicine")
    facility = require(db, Facility, payload.facility_id, "Facility")
    
    # Enforce Scope
    verify_scope(current_user, facility_id=payload.facility_id)
    
    record = ConsumptionRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    
    log_audit(
        db, 
        current_user, 
        "CREATE", 
        "CONSUMPTION_RECORD", 
        record.id, 
        f"Recorded consumption of {record.quantity_consumed} units of {medicine.name}",
        record.facility_id
    )
    return record
