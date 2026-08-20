import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, Warehouse
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


def require(db: Session, model: type, entity_id: uuid.UUID, label: str):
    entity = db.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return entity


def create(router: APIRouter, path: str, model: type, schema: type, out: type, label: str, fk_checks=()):
    @router.post(path, response_model=out, status_code=status.HTTP_201_CREATED)
    def create_entity(payload: schema, db: Session = Depends(get_db)):
        for field, fk_model, fk_label in fk_checks:
            require(db, fk_model, getattr(payload, field), fk_label)
        entity = model(**payload.model_dump())
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return entity


router = APIRouter()


@router.get("/districts", response_model=list[DistrictOut])
def list_districts(db: Session = Depends(get_db)):
    return db.scalars(select(District).order_by(District.name)).all()


create(router, "/districts", District, DistrictCreate, DistrictOut, "District")


@router.get("/facilities", response_model=list[FacilityOut])
def list_facilities(district_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = select(Facility).order_by(Facility.name)
    if district_id:
        query = query.where(Facility.district_id == district_id)
    return db.scalars(query).all()


create(router, "/facilities", Facility, FacilityCreate, FacilityOut, "Facility", (("district_id", District, "District"),))


@router.get("/warehouses", response_model=list[WarehouseOut])
def list_warehouses(district_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = select(Warehouse).order_by(Warehouse.name)
    if district_id:
        query = query.where(Warehouse.district_id == district_id)
    return db.scalars(query).all()


create(router, "/warehouses", Warehouse, WarehouseCreate, WarehouseOut, "Warehouse", (("district_id", District, "District"),))


@router.get("/medicines", response_model=list[MedicineOut])
def list_medicines(db: Session = Depends(get_db)):
    return db.scalars(select(Medicine).order_by(Medicine.name)).all()


create(router, "/medicines", Medicine, MedicineCreate, MedicineOut, "Medicine")


@router.get("/inventory", response_model=list[InventoryOut])
def list_inventory(
    facility_id: uuid.UUID | None = None,
    medicine_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
):
    query = select(InventoryBatch).order_by(InventoryBatch.expiry_date)
    if facility_id:
        query = query.where(InventoryBatch.facility_id == facility_id)
    if medicine_id:
        query = query.where(InventoryBatch.medicine_id == medicine_id)
    return db.scalars(query).all()


@router.post("/inventory", response_model=InventoryOut, status_code=status.HTTP_201_CREATED)
def add_inventory(payload: InventoryCreate, db: Session = Depends(get_db)):
    if payload.expiry_date <= date.today():
        raise HTTPException(status_code=422, detail="expiry_date must be in the future")
    require(db, Medicine, payload.medicine_id, "Medicine")
    if payload.facility_id:
        require(db, Facility, payload.facility_id, "Facility")
    if payload.warehouse_id:
        require(db, Warehouse, payload.warehouse_id, "Warehouse")
    batch = InventoryBatch(**payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/consumption", response_model=list[ConsumptionOut])
def list_consumption(
    facility_id: uuid.UUID | None = None,
    medicine_id: uuid.UUID | None = None,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(ConsumptionRecord).order_by(ConsumptionRecord.date.desc())
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
def record_consumption(payload: ConsumptionCreate, db: Session = Depends(get_db)):
    require(db, Facility, payload.facility_id, "Facility")
    require(db, Medicine, payload.medicine_id, "Medicine")
    record = ConsumptionRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
