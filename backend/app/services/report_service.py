import csv
import hashlib
import io
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import (
    AuditLog,
    District,
    Facility,
    InventoryBatch,
    Medicine,
    StockTransfer,
    User,
    UserRole,
    Warehouse,
)
from app.schemas.reports import DispatchManifestResponse


def generate_csv_export(db: Session, export_type: str, user: User | None = None) -> str:
    """Generates standard CSV data string for inventory, transfers, or audit logs."""
    output = io.StringIO()
    writer = csv.writer(output)

    if export_type == "inventory":
        writer.writerow(["Facility", "Medicine", "Category", "Batch Number", "Quantity", "Unit", "Expiry Date"])
        
        query = select(InventoryBatch)
        if user:
            if user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
                query = query.where(InventoryBatch.facility_id == user.facility_id)
            elif user.role == UserRole.WAREHOUSE_MANAGER.value:
                wh_ids = select(Warehouse.id).where(Warehouse.district_id == user.district_id)
                query = query.where(InventoryBatch.warehouse_id.in_(wh_ids))
            elif user.role == UserRole.DISTRICT_ADMIN.value:
                if user.district_id:
                    fac_ids = select(Facility.id).where(Facility.district_id == user.district_id)
                    wh_ids = select(Warehouse.id).where(Warehouse.district_id == user.district_id)
                    query = query.where(
                        (InventoryBatch.facility_id.in_(fac_ids)) |
                        (InventoryBatch.warehouse_id.in_(wh_ids))
                    )
        
        batches = db.scalars(query).all()
        facilities = {f.id: f.name for f in db.scalars(select(Facility)).all()}
        medicines = {m.id: m for m in db.scalars(select(Medicine)).all()}

        for b in batches:
            fac_name = facilities.get(b.facility_id, "Warehouse")
            med = medicines.get(b.medicine_id)
            writer.writerow([
                fac_name,
                med.name if med else "Unknown",
                med.category if med else "",
                b.batch_number,
                b.quantity,
                med.unit if med else "",
                b.expiry_date.isoformat() if b.expiry_date else "",
            ])

    elif export_type == "transfers":
        writer.writerow(["Tracking Number", "Source Facility", "Destination Facility", "Medicine", "Quantity", "Status", "Dispatched At"])
        
        query = select(StockTransfer)
        if user:
            if user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
                query = query.where(
                    (StockTransfer.source_facility_id == user.facility_id) |
                    (StockTransfer.destination_facility_id == user.facility_id)
                )
            elif user.role == UserRole.WAREHOUSE_MANAGER.value:
                if user.district_id:
                    wh_ids = select(Warehouse.id).where(Warehouse.district_id == user.district_id)
                    fac_ids = select(Facility.id).where(Facility.district_id == user.district_id)
                    query = query.where(
                        (StockTransfer.source_warehouse_id.in_(wh_ids)) |
                        (StockTransfer.source_facility_id.in_(fac_ids)) |
                        (StockTransfer.destination_facility_id.in_(fac_ids))
                    )
            elif user.role == UserRole.DISTRICT_ADMIN.value:
                if user.district_id:
                    fac_ids = select(Facility.id).where(Facility.district_id == user.district_id)
                    wh_ids = select(Warehouse.id).where(Warehouse.district_id == user.district_id)
                    query = query.where(
                        (StockTransfer.source_facility_id.in_(fac_ids)) |
                        (StockTransfer.destination_facility_id.in_(fac_ids)) |
                        (StockTransfer.source_warehouse_id.in_(wh_ids))
                    )

        transfers = db.scalars(query).all()
        facilities = {f.id: f.name for f in db.scalars(select(Facility)).all()}
        medicines = {m.id: m.name for m in db.scalars(select(Medicine)).all()}

        for t in transfers:
            writer.writerow([
                t.tracking_number,
                facilities.get(t.source_facility_id, "Warehouse"),
                facilities.get(t.destination_facility_id, "Unknown"),
                medicines.get(t.medicine_id, "Unknown"),
                t.quantity,
                t.status,
                t.dispatched_at.isoformat() if t.dispatched_at else "",
            ])

    elif export_type == "audit":
        if user and user.role != UserRole.DISTRICT_ADMIN.value:
            raise HTTPException(status_code=403, detail="Access denied: Only District Admins can export audit logs")

        writer.writerow(["Timestamp", "Action", "Entity", "Description"])
        
        query = select(AuditLog).order_by(AuditLog.timestamp.desc())
        if user and user.district_id:
            fac_ids = select(Facility.id).where(Facility.district_id == user.district_id)
            user_ids = select(User.id).where(User.district_id == user.district_id)
            query = query.where((AuditLog.facility_id.in_(fac_ids)) | (AuditLog.user_id.in_(user_ids)))

        logs = db.scalars(query).all()
        for l in logs:
            writer.writerow([
                l.timestamp.isoformat(),
                l.action,
                l.entity,
                l.description,
            ])
    else:
        raise HTTPException(status_code=400, detail=f"Invalid export_type '{export_type}'. Use inventory, transfers, or audit.")

    return output.getvalue()


def generate_dispatch_manifest(db: Session, transfer_id: uuid.UUID, user: User | None = None) -> DispatchManifestResponse:
    """Generates official government stock transfer receipt/manifest data."""
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if user:
        from app.core.dependencies import verify_transfer_scope
        verify_transfer_scope(user, transfer, db)

    src_fac = db.get(Facility, transfer.source_facility_id) if transfer.source_facility_id else None
    dst_fac = db.get(Facility, transfer.destination_facility_id)
    med = db.get(Medicine, transfer.medicine_id)

    district_name = "Gujarat State Health Network"
    if dst_fac and dst_fac.district_id:
        d = db.get(District, dst_fac.district_id)
        if d:
            district_name = d.name

    # Hash for verification security
    raw_sig = f"{transfer.tracking_number}:{transfer.quantity}:{datetime.now().strftime('%Y%m%d')}"
    security_hash = hashlib.sha256(raw_sig.encode()).hexdigest()[:16].upper()

    return DispatchManifestResponse(
        transfer_id=transfer.id,
        tracking_number=transfer.tracking_number,
        issued_at=datetime.now(),
        district_name=district_name,
        source_facility_name=src_fac.name if src_fac else "Central District Warehouse",
        source_address=src_fac.address if src_fac else "District Medical Stores Depo",
        destination_facility_name=dst_fac.name if dst_fac else "Destination Health Facility",
        destination_address=dst_fac.address if dst_fac else "PHC Centre",
        medicine_name=med.name if med else "Essential Medicine",
        generic_name=med.generic_name if med else "Generic",
        unit=med.unit if med else "units",
        quantity=transfer.quantity,
        batch_number="BATCH-DISPATCH-001",
        expiry_date=date.today(),
        status=transfer.status,
        security_hash=security_hash,
    )
