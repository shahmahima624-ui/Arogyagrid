import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
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
from app.services.safety_service import calculate_safe_surplus


def _generate_tracking_number(db: Session) -> str:
    """Generates sequential tracking number e.g. TRF-20260822-ABCDEF."""
    datestr = datetime.now(timezone.utc).strftime("%Y%m%d")
    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    return f"TRF-{datestr}-{unique_suffix}"


def _add_audit_log(
    db: Session,
    user_id: uuid.UUID,
    action: str,
    transfer: StockTransfer,
    description: str,
) -> None:
    """Create a lifecycle audit log entry for a transfer event."""
    log = AuditLog(
        user_id=user_id,
        facility_id=transfer.source_facility_id,
        action=action,
        entity="StockTransfer",
        entity_id=transfer.id,
        description=description,
    )
    db.add(log)


def _validate_source_safe_surplus(
    db: Session,
    transfer: StockTransfer,
    action_label: str,
) -> None:
    """
    Revalidate the source facility safe surplus before approval or dispatch.
    Raises 409 Conflict if the transfer quantity now exceeds what can safely be donated.
    Only applies to facility-sourced transfers (warehouses are not safety-stock checked).
    """
    if not transfer.source_facility_id:
        # Warehouse source — no safe-surplus constraint
        return

    result = calculate_safe_surplus(db, transfer.source_facility_id, transfer.medicine_id)

    if not result.evaluation_available:
        # No consumption history — fall back to raw stock check only
        if result.current_stock < transfer.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient source stock ({result.current_stock} available, "
                    f"{transfer.quantity} requested). Cannot {action_label}."
                ),
            )
        return

    if transfer.quantity > result.safe_surplus:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Transfer recommendation is no longer safe: source safe surplus is "
                f"{result.safe_surplus} units (stock={result.current_stock}, "
                f"predicted_requirement={result.predicted_requirement:.0f}, "
                f"safety_stock={result.safety_stock:.0f}). "
                f"Transfer requires {transfer.quantity}. "
                f"Regenerate recommendation."
            ),
        )


# ─── STRICT TRANSFER STATE MACHINE ────────────────────────────────────────────
#
# Allowed transitions:
#   PENDING    → approve  → APPROVED
#   PENDING    → reject   → REJECTED
#   PENDING    → cancel   → CANCELLED
#   APPROVED   → dispatch → IN_TRANSIT
#   APPROVED   → cancel   → CANCELLED
#   IN_TRANSIT → receive  → RECEIVED
#
# All other transitions → 409 Conflict


def create_transfer_from_recommendation(
    db: Session,
    recommendation_id: uuid.UUID,
    user: User,
    notes: str | None = None,
) -> StockTransfer:
    rec = db.get(RedistributionRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redistribution recommendation not found.")

    if rec.status in [RecommendationStatus.APPROVED, RecommendationStatus.REJECTED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Recommendation is already in {rec.status} state.")

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

    _add_audit_log(db, user.id, "TRANSFER_CREATED", transfer,
                   f"Transfer {transfer.tracking_number} created from recommendation.")
    db.commit()
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
    if quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer quantity must be greater than zero.")
    if not source_facility_id and not source_warehouse_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Must specify either source_facility_id or source_warehouse_id.")
    if source_facility_id and source_warehouse_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot specify both source_facility_id and source_warehouse_id.")
    if source_facility_id and source_facility_id == destination_facility_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source and destination facility cannot be the same.")

    # Validate source stock using centralized safe-surplus function
    if source_facility_id:
        surplus_result = calculate_safe_surplus(db, source_facility_id, medicine_id)

        if surplus_result.evaluation_available:
            # We have consumption history — enforce safety constraint
            if quantity > surplus_result.safe_surplus:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Manual transfer exceeds safe surplus: safe_surplus={surplus_result.safe_surplus}, "
                        f"requested={quantity}. Source stock={surplus_result.current_stock}, "
                        f"predicted_requirement={surplus_result.predicted_requirement:.0f}, "
                        f"safety_stock={surplus_result.safety_stock:.0f}. "
                        f"Manual transfers must respect the same safety rules as AI recommendations."
                    ),
                )
        else:
            # No consumption history — raw stock check only
            if surplus_result.current_stock < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient source stock ({surplus_result.current_stock} available, {quantity} requested).",
                )
    else:
        # Warehouse source — raw stock check
        today = date.today()
        query = select(InventoryBatch).where(
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.quantity > 0,
            InventoryBatch.expiry_date >= today,
            InventoryBatch.warehouse_id == source_warehouse_id,
        )
        batches = db.scalars(query).all()
        available = sum(b.quantity for b in batches)
        if available < quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient warehouse stock ({available} available, {quantity} requested).",
            )

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

    _add_audit_log(db, user.id, "TRANSFER_CREATED", transfer,
                   f"Manual transfer {transfer.tracking_number} created.")
    db.commit()
    return transfer


def approve_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found.")

    # STATE MACHINE: Only PENDING → APPROVED
    if transfer.status != TransferStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve transfer in '{transfer.status}' status. Transfer must be PENDING.",
        )

    # Revalidate safe surplus at time of approval (recommendation may be stale)
    _validate_source_safe_surplus(db, transfer, "approve")

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

    _add_audit_log(db, user.id, "TRANSFER_APPROVED", transfer,
                   f"Transfer {transfer.tracking_number} approved.")
    db.commit()
    return transfer


def dispatch_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found.")

    # STATE MACHINE: Only APPROVED → IN_TRANSIT
    if transfer.status != TransferStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transfer must be APPROVED before dispatch. Current status: '{transfer.status}'.",
        )

    # Revalidate safe surplus immediately before physical dispatch
    # (inventory or demand may have changed since approval)
    _validate_source_safe_surplus(db, transfer, "dispatch")

    transfer.status = TransferStatus.IN_TRANSIT
    transfer.dispatched_at = datetime.now(timezone.utc)
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Dispatch note: {notes}"

    db.commit()
    db.refresh(transfer)

    _add_audit_log(db, user.id, "TRANSFER_DISPATCHED", transfer,
                   f"Transfer {transfer.tracking_number} dispatched — now IN_TRANSIT.")
    db.commit()
    return transfer


def receive_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    """
    Executes actual inventory reconciliation in a strict DB transaction.
    Rejects duplicate receive requests with 409 Conflict.
    STATE MACHINE: Only IN_TRANSIT → RECEIVED.
    Deducts stock from source (FEFO) and adds stock to destination.
    Creates audit records.
    """
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found.")

    # STATE MACHINE: Already received → idempotent 409
    if transfer.status == TransferStatus.RECEIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer has already been received and inventory reconciled.")

    # STATE MACHINE: Only IN_TRANSIT → RECEIVED
    if transfer.status != TransferStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transfer must be IN_TRANSIT before receipt. Current status: '{transfer.status}'.",
        )

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
            status_code=status.HTTP_409_CONFLICT,
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

    # 3. Create Audit Logs for stock movement
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

    _add_audit_log(db, user.id, "TRANSFER_RECEIVED", transfer,
                   f"Transfer {transfer.tracking_number} received — inventory reconciled.")
    db.commit()
    return transfer


def reject_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found.")

    # STATE MACHINE: Only PENDING can be rejected
    if transfer.status not in [TransferStatus.PENDING]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject transfer in '{transfer.status}' status. Only PENDING transfers may be rejected.",
        )

    transfer.status = TransferStatus.REJECTED
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Rejected note: {notes}"

    if transfer.recommendation_id:
        rec = db.get(RedistributionRecommendation, transfer.recommendation_id)
        if rec:
            rec.status = RecommendationStatus.REJECTED

    db.commit()
    db.refresh(transfer)

    _add_audit_log(db, user.id, "TRANSFER_REJECTED", transfer,
                   f"Transfer {transfer.tracking_number} rejected.")
    db.commit()
    return transfer


def cancel_transfer(db: Session, transfer_id: uuid.UUID, user: User, notes: str | None = None) -> StockTransfer:
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found.")

    # STATE MACHINE: Only PENDING or APPROVED can be cancelled
    if transfer.status not in [TransferStatus.PENDING, TransferStatus.APPROVED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel transfer in '{transfer.status}' status. Only PENDING or APPROVED transfers may be cancelled.",
        )

    transfer.status = TransferStatus.CANCELLED
    if notes:
        transfer.notes = f"{transfer.notes or ''} | Cancelled note: {notes}"

    if transfer.recommendation_id:
        rec = db.get(RedistributionRecommendation, transfer.recommendation_id)
        if rec:
            rec.status = RecommendationStatus.CANCELLED

    db.commit()
    db.refresh(transfer)

    _add_audit_log(db, user.id, "TRANSFER_CANCELLED", transfer,
                   f"Transfer {transfer.tracking_number} cancelled.")
    db.commit()
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
