import json
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import (
    AuditLog,
    ConsumptionRecord,
    District,
    Facility,
    InventoryBatch,
    Medicine,
    StockTransfer,
    User,
)
from app.schemas.backup import BackupSnapshotResponse, RestoreResponse


def create_backup_snapshot(db: Session, user: User | None = None) -> BackupSnapshotResponse:
    today_iso = datetime.now(timezone.utc)
    snapshot_id = f"BACKUP-{today_iso.strftime('%Y%m%d-%H%M%S')}"

    districts = [
        {"id": str(d.id), "name": d.name, "state": d.state, "status": d.status}
        for d in db.scalars(select(District)).all()
    ]

    facilities = [
        {
            "id": str(f.id),
            "district_id": str(f.district_id),
            "name": f.name,
            "facility_type": f.facility_type,
            "address": f.address,
            "latitude": f.latitude,
            "longitude": f.longitude,
            "status": f.status,
        }
        for f in db.scalars(select(Facility)).all()
    ]

    medicines = [
        {
            "id": str(m.id),
            "name": m.name,
            "generic_name": m.generic_name,
            "category": m.category,
            "unit": m.unit,
            "manufacturer": m.manufacturer,
        }
        for m in db.scalars(select(Medicine)).all()
    ]

    batches = [
        {
            "id": str(b.id),
            "facility_id": str(b.facility_id) if b.facility_id else None,
            "medicine_id": str(b.medicine_id),
            "batch_number": b.batch_number,
            "quantity": b.quantity,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        }
        for m in db.scalars(select(InventoryBatch)).all() if hasattr(m, "id") # fallback
    ]

    snapshot_json = {
        "snapshot_id": snapshot_id,
        "created_at": today_iso.isoformat(),
        "districts": districts,
        "facilities": facilities,
        "medicines": medicines,
        "inventory_batches": batches,
    }

    tables_summary = {
        "districts": len(districts),
        "facilities": len(facilities),
        "medicines": len(medicines),
        "inventory_batches": len(batches),
    }

    if user:
        audit = AuditLog(
            user_id=user.id,
            action="BACKUP_CREATED",
            entity="DatabaseSnapshot",
            description=f"Created backup snapshot {snapshot_id} ({len(batches)} batches).",
        )
        db.add(audit)
        db.commit()

    return BackupSnapshotResponse(
        snapshot_id=snapshot_id,
        created_at=today_iso,
        tables_backed_up=tables_summary,
        snapshot_json=snapshot_json,
    )


def restore_backup_snapshot(db: Session, snapshot_json: dict[str, Any], user: User | None = None) -> RestoreResponse:
    districts_data = snapshot_json.get("districts", [])
    facilities_data = snapshot_json.get("facilities", [])
    medicines_data = snapshot_json.get("medicines", [])
    batches_data = snapshot_json.get("inventory_batches", [])

    # Restore Districts
    for d in districts_data:
        d_id = uuid.UUID(d["id"])
        existing = db.get(District, d_id)
        if not existing:
            db.add(District(id=d_id, name=d["name"], state=d["state"], status=d.get("status", "ACTIVE")))

    # Restore Facilities
    for f in facilities_data:
        f_id = uuid.UUID(f["id"])
        existing = db.get(Facility, f_id)
        if not existing:
            db.add(Facility(
                id=f_id,
                district_id=uuid.UUID(f["district_id"]),
                name=f["name"],
                facility_type=f["facility_type"],
                address=f.get("address"),
                latitude=f.get("latitude"),
                longitude=f.get("longitude"),
                status=f.get("status", "ACTIVE"),
            ))

    # Restore Medicines
    for m in medicines_data:
        m_id = uuid.UUID(m["id"])
        existing = db.get(Medicine, m_id)
        if not existing:
            db.add(Medicine(
                id=m_id,
                name=m["name"],
                generic_name=m["generic_name"],
                category=m["category"],
                unit=m["unit"],
                manufacturer=m.get("manufacturer"),
            ))

    # Restore Batches
    for b in batches_data:
        b_id = uuid.UUID(b["id"])
        existing = db.get(InventoryBatch, b_id)
        if not existing:
            db.add(InventoryBatch(
                id=b_id,
                facility_id=uuid.UUID(b["facility_id"]) if b.get("facility_id") else None,
                medicine_id=uuid.UUID(b["medicine_id"]),
                batch_number=b["batch_number"],
                quantity=b["quantity"],
                expiry_date=date.fromisoformat(b["expiry_date"]) if b.get("expiry_date") else date.today(),
            ))

    if user:
        audit = AuditLog(
            user_id=user.id,
            action="BACKUP_RESTORED",
            entity="DatabaseSnapshot",
            description=f"Restored database snapshot ({len(batches_data)} batches).",
        )
        db.add(audit)

    db.commit()

    tables_restored = {
        "districts": len(districts_data),
        "facilities": len(facilities_data),
        "medicines": len(medicines_data),
        "inventory_batches": len(batches_data),
    }

    return RestoreResponse(
        success=True,
        restored_at=datetime.now(timezone.utc),
        tables_restored=tables_restored,
        message="Successfully restored database snapshot.",
    )
