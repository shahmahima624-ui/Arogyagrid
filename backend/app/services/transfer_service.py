import uuid
from datetime import date, datetime, timedelta, timezone


from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import (
    AuditLog,
    Facility,
    InventoryBatch,
    Medicine,
    RecommendationStatus,
    RedistributionRecommendation,
    StockTransfer,
    TransferStatus,
    User,
    Warehouse,
)


def _generate_tracking_number(db: Session) -> str:
    """Generates sequential tracking number e.g. TRF-20260822-0042."""
    datestr = datetime.now(timezone.utc).strftime("%Y%m%m")
    count = db.scalar(select(StockTransfer).execution_options(populate_existing=True))
    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    return f"TRF-{datestr}-{unique_suffix}"


def create_transfer_from_recommendation(
    db: Session,
    recommendation_id: uuid.UUID,
    user: User,
    notes: str | None = None,
) -> StockTransfer:
    rec = db.get(RedistributionRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Redistribution recommendation not found.")

    if rec.status in [RecommendationStatus.APPROVED, RecommendationStatus.REJECTED]:
        raise HTTPException(status_code=400, detail=f"Recommendation is already in {rec.status} state.")

    tracking_num = _generate_tracking_number(db)
    transfer = StockTransfer(
        tracking_number=tracking_num,
        recommendation_id=rec.id,
        source_facility_id=rec.source_facility_id,
        source_warehouse_id=rec.source_warehouse_id,
        destination_facility_id=rec.destination_facility_id,
        medicine_id=rec.medicine_id,
        quantity=rec.recommended_quantity,
        status=TransferStatus.PENDING,
        created_by_user_id=user.id,
        notes=notes or f"Generated from AI recommendation (Score: {rec.score:.2f})",
    )

    rec.status = RecommendationStatus.PENDING
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


def create_manual_transfer(
    db: Session,
    source_facility_id: uuid.UUID | None,
    source_warehouse_id: uuid.UUID | None,
    destination_facility_id: uuid.UUID,
    medicine_id: uuid.UUID,
    quantity: int,
    user: User,
    notes: str | None = None,
) -> StockTransfer:
    if not source_facility_id and not source_warehouse_id:
        raise HTTPException(status_code=400, detail="Must specify either source_facility_id or source_warehouse_id.")
    if source_facility_id and source_facility_id == destination_facility_id:
        raise HTTPException(status_code=400, detail="Source and destination facility cannot be the same.")

    tracking_num = _generate_tracking_number(db)
    transfer = StockTransfer(
        tracking_number=tracking_num,
        source_facility_id=source_facility_id,
        source_warehouse_id=source_warehouse_id,
        destination_facility_id=destination_facility_id,
        medicine_id=medicine_id,
        quantity=quantity,
        status=TransferStatus.PENDING,
        created_by_user_id=user.id,
        notes=notes,
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


def approve_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")

    if transfer.status != TransferStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot approve transfer in '{transfer.status}' status.")

    transfer.status = TransferStatus.APPROVED
    transfer.approved_by_user_id = user.id
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Approved note: {notes}"

    if transfer.recommendation_id:
        rec = db.get(RedistributionRecommendation, transfer.recommendation_id)
        if rec:
            rec.status = RecommendationStatus.APPROVED

    db.commit()
    db.refresh(transfer)
    return transfer


def dispatch_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")

    if transfer.status not in [TransferStatus.PENDING, TransferStatus.APPROVED]:
        raise HTTPException(status_code=400, detail=f"Cannot dispatch transfer in '{transfer.status}' status.")

    transfer.status = TransferStatus.IN_TRANSIT
    transfer.dispatched_at = datetime.now(timezone.utc)
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Dispatch note: {notes}"

    db.commit()
    db.refresh(transfer)
    return transfer


def receive_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    """
    Executes actual inventory reconciliation in a strict DB transaction.
    Rejects duplicate receive requests.
    Deducts stock from source (FEFO) and adds stock to destination.
    Creates audit records.
    """
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")

    if transfer.status == TransferStatus.RECEIVED:
        raise HTTPException(status_code=400, detail="Transfer has already been received and inventory reconciled.")

    if transfer.status not in [TransferStatus.IN_TRANSIT, TransferStatus.APPROVED]:
        raise HTTPException(status_code=400, detail=f"Cannot receive transfer in '{transfer.status}' status.")

    today = date.today()
    remaining_qty_to_deduct = transfer.quantity
    earliest_expiry = today + timedelta(days=180)

    # 1. Deduct from source batches using FEFO
    source_batches_query = select(InventoryBatch).where(
        InventoryBatch.medicine_id == transfer.medicine_id,
        InventoryBatch.quantity > 0,
        InventoryBatch.expiry_date >= today,
    )
    if transfer.source_facility_id:
        source_batches_query = source_batches_query.where(InventoryBatch.facility_id == transfer.source_facility_id)
    elif transfer.source_warehouse_id:
        source_batches_query = source_batches_query.where(InventoryBatch.warehouse_id == transfer.source_warehouse_id)

    source_batches = db.scalars(source_batches_query.order_by(InventoryBatch.expiry_date.asc())).all()

    total_avail = sum(b.quantity for b in source_batches)
    if total_avail < transfer.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient source inventory available ({total_avail} units available, {transfer.quantity} requested).",
        )

    for b in source_batches:
        if remaining_qty_to_deduct <= 0:
            break
        deduct = min(b.quantity, remaining_qty_to_deduct)
        b.quantity -= deduct
        remaining_qty_to_deduct -= deduct
        if b.expiry_date < earliest_expiry:
            earliest_expiry = b.expiry_date

    # 2. Add inventory to destination facility
    dest_batch = InventoryBatch(
        facility_id=transfer.destination_facility_id,
        medicine_id=transfer.medicine_id,
        batch_number=f"TRF-{transfer.tracking_number[-8:]}",
        quantity=transfer.quantity,
        expiry_date=earliest_expiry,
    )
    db.add(dest_batch)

    # 3. Create Audit Logs
    med = db.get(Medicine, transfer.medicine_id)
    med_name = med.name if med else "Medicine"

    audit_out = AuditLog(
        user_id=user.id,
        facility_id=transfer.source_facility_id,
        action="TRANSFER_OUT",
        entity="InventoryBatch",
        entity_id=transfer.id,
        description=f"Dispatched {transfer.quantity} units of {med_name} via transfer {transfer.tracking_number}.",
    )
    audit_in = AuditLog(
        user_id=user.id,
        facility_id=transfer.destination_facility_id,
        action="TRANSFER_IN",
        entity="InventoryBatch",
        entity_id=dest_batch.id,
        description=f"Received {transfer.quantity} units of {med_name} via transfer {transfer.tracking_number}.",
    )
    db.add_all([audit_out, audit_in])

    # 4. Finalize transfer record
    transfer.status = TransferStatus.RECEIVED
    transfer.received_at = datetime.now(timezone.utc)
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Receive note: {notes}"

    if transfer.recommendation_id:
        rec = db.get(RedistributionRecommendation, transfer.recommendation_id)
        if rec:
            rec.status = RecommendationStatus.APPROVED

    db.commit()
    db.refresh(transfer)
    return transfer


def reject_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")

    if transfer.status in [TransferStatus.RECEIVED, TransferStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail=f"Cannot reject transfer in '{transfer.status}' status.")

    transfer.status = TransferStatus.REJECTED
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Rejected note: {notes}"

    if transfer.recommendation_id:
        rec = db.get(RedistributionRecommendation, transfer.recommendation_id)
        if rec:
            rec.status = RecommendationStatus.REJECTED

    db.commit()
    db.refresh(transfer)
    return transfer


def cancel_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")

    if transfer.status in [TransferStatus.RECEIVED, TransferStatus.REJECTED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel transfer in '{transfer.status}' status.")

    transfer.status = TransferStatus.CANCELLED
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Cancelled note: {notes}"

    if transfer.recommendation_id:
        rec = db.get(RedistributionRecommendation, transfer.recommendation_id)
        if rec:
            rec.status = RecommendationStatus.CANCELLED

    db.commit()
    db.refresh(transfer)
    return transfer


def list_transfers(
    db: Session,
    facility_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[StockTransfer]:
    q = select(StockTransfer)
    if status:
        q = q.where(StockTransfer.status == status)
    if facility_id:
        q = q.where(
            (StockTransfer.destination_facility_id == facility_id)
            | (StockTransfer.source_facility_id == facility_id)
        )
    q = q.order_by(StockTransfer.created_at.desc())
    return db.scalars(q).all()
