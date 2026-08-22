import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import Facility, Medicine, StockTransfer, User, UserRole, Warehouse
from app.schemas.transfers import (
    StockTransferOut,
    TransferActionRequest,
    TransferCreateFromRecommendation,
    TransferCreateManual,
)
from app.services import transfer_service

router = APIRouter()


def _to_transfer_out(t: StockTransfer, db: Session) -> StockTransferOut:
    src_fac = db.get(Facility, t.source_facility_id) if t.source_facility_id else None
    src_wh = db.get(Warehouse, t.source_warehouse_id) if t.source_warehouse_id else None
    dest_fac = db.get(Facility, t.destination_facility_id)
    med = db.get(Medicine, t.medicine_id)

    creator = db.get(User, t.created_by_user_id) if t.created_by_user_id else None
    approver = db.get(User, t.approved_by_user_id) if t.approved_by_user_id else None

    return StockTransferOut(
        id=t.id,
        tracking_number=t.tracking_number,
        recommendation_id=t.recommendation_id,
        source_facility_id=t.source_facility_id,
        source_facility_name=src_fac.name if src_fac else None,
        source_warehouse_id=t.source_warehouse_id,
        source_warehouse_name=src_wh.name if src_wh else None,
        destination_facility_id=t.destination_facility_id,
        destination_facility_name=dest_fac.name if dest_fac else "Unknown",
        medicine_id=t.medicine_id,
        medicine_name=med.name if med else "Unknown",
        category=med.category if med else "",
        unit=med.unit if med else "",
        quantity=t.quantity,
        status=t.status,
        created_by_user_id=t.created_by_user_id,
        created_by_user_name=creator.name if creator else None,
        approved_by_user_id=t.approved_by_user_id,
        approved_by_user_name=approver.name if approver else None,
        dispatched_at=t.dispatched_at,
        received_at=t.received_at,
        notes=t.notes,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.post("/from-recommendation/{recommendation_id}", response_model=StockTransferOut)
def create_from_recommendation(
    recommendation_id: uuid.UUID,
    body: TransferActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = body.notes if body else None
    transfer = transfer_service.create_transfer_from_recommendation(
        db=db, recommendation_id=recommendation_id, user=current_user, notes=notes
    )
    return _to_transfer_out(transfer, db)


@router.post("/manual", response_model=StockTransferOut)
def create_manual(
    body: TransferCreateManual,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transfer = transfer_service.create_manual_transfer(
        db=db,
        source_facility_id=body.source_facility_id,
        source_warehouse_id=body.source_warehouse_id,
        destination_facility_id=body.destination_facility_id,
        medicine_id=body.medicine_id,
        quantity=body.quantity,
        user=current_user,
        notes=body.notes,
    )
    return _to_transfer_out(transfer, db)


@router.get("", response_model=list[StockTransferOut])
@router.get("/", response_model=list[StockTransferOut])
def list_all_transfers(
    status: str | None = Query(None, description="Filter by status"),
    facility_id: uuid.UUID | None = Query(None, description="Filter by facility"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    effective_facility = facility_id
    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility = current_user.facility_id

    transfers = transfer_service.list_transfers(db, facility_id=effective_facility, status=status)
    return [_to_transfer_out(t, db) for t in transfers]


@router.get("/{transfer_id}", response_model=StockTransferOut)
def get_transfer_by_id(
    transfer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.get(StockTransfer, transfer_id)
    if not t:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")
    return _to_transfer_out(t, db)


@router.post("/{transfer_id}/approve", response_model=StockTransferOut)
def approve(
    transfer_id: uuid.UUID,
    body: TransferActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = body.notes if body else None
    t = transfer_service.approve_transfer(db, transfer_id=transfer_id, user=current_user, notes=notes)
    return _to_transfer_out(t, db)


@router.post("/{transfer_id}/dispatch", response_model=StockTransferOut)
def dispatch(
    transfer_id: uuid.UUID,
    body: TransferActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = body.notes if body else None
    t = transfer_service.dispatch_transfer(db, transfer_id=transfer_id, user=current_user, notes=notes)
    return _to_transfer_out(t, db)


@router.post("/{transfer_id}/receive", response_model=StockTransferOut)
def receive(
    transfer_id: uuid.UUID,
    body: TransferActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = body.notes if body else None
    t = transfer_service.receive_transfer(db, transfer_id=transfer_id, user=current_user, notes=notes)
    return _to_transfer_out(t, db)


@router.post("/{transfer_id}/reject", response_model=StockTransferOut)
def reject(
    transfer_id: uuid.UUID,
    body: TransferActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = body.notes if body else None
    t = transfer_service.reject_transfer(db, transfer_id=transfer_id, user=current_user, notes=notes)
    return _to_transfer_out(t, db)


@router.post("/{transfer_id}/cancel", response_model=StockTransferOut)
def cancel(
    transfer_id: uuid.UUID,
    body: TransferActionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = body.notes if body else None
    t = transfer_service.cancel_transfer(db, transfer_id=transfer_id, user=current_user, notes=notes)
    return _to_transfer_out(t, db)
