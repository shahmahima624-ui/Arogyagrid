import uuid
from datetime import date, datetime, timezone
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import (
    ConsumptionRecord,
    District,
    Facility,
    InventoryBatch,
    Medicine,
    Warehouse,
    User,
    UserRole,
    AuditLog,
)
from app.schemas.dashboard import (
    ActivityFeedItem,
    CategoryStockItem,
    CommandCenterKPIs,
    CommandCenterResponse,
    ExpiryAlertItem,
    FacilityHealthItem,
    StockAlertItem,
)
from app.core.dependencies import get_current_user

router = APIRouter()

DEFAULT_REORDER_LEVEL = 150  # Units threshold for static current stock alert


@router.get("/command-center", response_model=CommandCenterResponse)
def get_command_center_overview(
    district_id: uuid.UUID | None = Query(None, description="Optional district filter"),
    facility_id: uuid.UUID | None = Query(None, description="Optional facility filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    now = datetime.now(timezone.utc)

    # Apply strict role scoping
    effective_facility_id = facility_id
    effective_district_id = district_id

    if current_user.role in [UserRole.FACILITY_ADMIN, UserRole.HEALTHCARE_STAFF]:
        effective_facility_id = current_user.facility_id
        if current_user.facility_id:
            user_facility = db.get(Facility, current_user.facility_id)
            effective_district_id = user_facility.district_id if user_facility else current_user.district_id
        else:
            effective_district_id = current_user.district_id

        if facility_id and effective_facility_id and facility_id != effective_facility_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access dashboard outside your assigned facility",
            )
        if district_id and effective_district_id and district_id != effective_district_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access dashboard outside your assigned district",
            )

    elif current_user.role == UserRole.WAREHOUSE_MANAGER:
        effective_facility_id = None
        effective_district_id = current_user.district_id
        if district_id and effective_district_id and district_id != effective_district_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access dashboard outside your assigned district",
            )

    elif current_user.role == UserRole.DISTRICT_ADMIN:
        effective_district_id = current_user.district_id
        if district_id and current_user.district_id and district_id != current_user.district_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access dashboard outside your assigned district",
            )
        if facility_id and effective_district_id:
            fac_obj = db.get(Facility, facility_id)
            if fac_obj and fac_obj.district_id != effective_district_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Facility is outside your assigned district",
                )
    else:
        effective_facility_id = facility_id
        effective_district_id = current_user.district_id or district_id

    # 1. Fetch facilities
    fac_query = select(Facility).join(District, Facility.district_id == District.id)
    if effective_district_id:
        fac_query = fac_query.where(Facility.district_id == effective_district_id)
    if effective_facility_id:
        fac_query = fac_query.where(Facility.id == effective_facility_id)
    facilities = db.scalars(fac_query.order_by(Facility.name)).all()

    # Facility dictionary for fast lookups
    facility_map = {f.id: f for f in facilities}
    district_map = {d.id: d.name for d in db.scalars(select(District)).all()}

    # 2. Fetch medicines
    medicines = db.scalars(select(Medicine).order_by(Medicine.name)).all()
    medicine_map = {m.id: m for m in medicines}
    total_medicines = len(medicines)

    # 3. Fetch warehouses
    wh_query = select(Warehouse)
    if effective_district_id:
        wh_query = wh_query.where(Warehouse.district_id == effective_district_id)
    warehouses = db.scalars(wh_query).all()
    warehouse_map = {w.id: w for w in warehouses}

    # 4. Fetch inventory batches (active or expiring)
    batch_query = select(InventoryBatch)
    if effective_facility_id:
        batch_query = batch_query.where(InventoryBatch.facility_id == effective_facility_id)
    elif effective_district_id:
        allowed_fac_ids = [f.id for f in facilities]
        allowed_wh_ids = [w.id for w in warehouses]
        batch_query = batch_query.where(
            (InventoryBatch.facility_id.in_(allowed_fac_ids)) | (InventoryBatch.warehouse_id.in_(allowed_wh_ids))
        )
    batches = db.scalars(batch_query).all()

    # Aggregate inventory units
    total_inventory_units = sum(b.quantity for b in batches)

    # Structure data per facility
    facility_stock = defaultdict(lambda: defaultdict(int))  # facility_id -> medicine_id -> total_qty
    facility_expiring = defaultdict(int)  # facility_id -> expiring batch count
    facility_total_units = defaultdict(int)

    # Expiry Alerts
    expiry_alerts: list[ExpiryAlertItem] = []
    expiring_soon_count = 0

    for batch in batches:
        days_remaining = (batch.expiry_date - today).days
        med = medicine_map.get(batch.medicine_id)
        med_name = med.name if med else "Unknown"
        med_category = med.category if med else "General"

        fac = facility_map.get(batch.facility_id) if batch.facility_id else None
        wh = warehouse_map.get(batch.warehouse_id) if batch.warehouse_id else None

        if batch.facility_id:
            facility_stock[batch.facility_id][batch.medicine_id] += batch.quantity
            facility_total_units[batch.facility_id] += batch.quantity

        # Check for upcoming expiries (within 90 days)
        if 0 <= days_remaining <= 90 and batch.quantity > 0:
            expiring_soon_count += 1
            if batch.facility_id:
                facility_expiring[batch.facility_id] += 1

            urgency = "CRITICAL_30" if days_remaining <= 30 else ("WARNING_60" if days_remaining <= 60 else "ATTENTION_90")
            expiry_alerts.append(
                ExpiryAlertItem(
                    batch_id=batch.id,
                    batch_number=batch.batch_number,
                    medicine_id=batch.medicine_id,
                    medicine_name=med_name,
                    category=med_category,
                    quantity=batch.quantity,
                    expiry_date=batch.expiry_date,
                    days_remaining=days_remaining,
                    urgency=urgency,
                    facility_id=batch.facility_id,
                    facility_name=fac.name if fac else None,
                    warehouse_id=batch.warehouse_id,
                    warehouse_name=wh.name if wh else None,
                )
            )

    expiry_alerts.sort(key=lambda x: x.days_remaining)

    # Stock Alerts & Low Stock Calculations
    stock_alerts: list[StockAlertItem] = []
    facility_low_stock_count = defaultdict(int)
    low_stock_items_count = 0

    for fac in facilities:
        # Check stock across key medicines
        for med in medicines:
            curr_stock = facility_stock[fac.id][med.id]
            reorder_lvl = DEFAULT_REORDER_LEVEL

            if curr_stock < reorder_lvl:
                low_stock_items_count += 1
                facility_low_stock_count[fac.id] += 1
                stock_status = "OUT_OF_STOCK" if curr_stock == 0 else "LOW_STOCK"

                # Include in stock alerts list (limit per facility or sorted)
                stock_alerts.append(
                    StockAlertItem(
                        facility_id=fac.id,
                        facility_name=fac.name,
                        medicine_id=med.id,
                        medicine_name=med.name,
                        category=med.category,
                        current_stock=curr_stock,
                        reorder_level=reorder_lvl,
                        status=stock_status,
                    )
                )

    stock_alerts.sort(key=lambda x: (x.current_stock, x.medicine_name))

    # Facility Health Items
    facility_health: list[FacilityHealthItem] = []
    critical_facilities_count = 0

    for fac in facilities:
        low_count = facility_low_stock_count[fac.id]
        exp_count = facility_expiring[fac.id]
        tot_stock = facility_total_units[fac.id]

        if low_count >= 3 or tot_stock < 500:
            health_status = "CRITICAL"
            critical_facilities_count += 1
        elif low_count >= 1 or exp_count >= 1:
            health_status = "WARNING"
        else:
            health_status = "NORMAL"

        district_name = district_map.get(fac.district_id, "District")

        facility_health.append(
            FacilityHealthItem(
                id=fac.id,
                name=fac.name,
                facility_type=fac.facility_type,
                district_name=district_name,
                total_stock=tot_stock,
                low_stock_count=low_count,
                expiring_count=exp_count,
                status=health_status,
                last_consumption_date=None,
            )
        )

    # Sort facility health: CRITICAL first, then WARNING, then NORMAL
    status_priority = {"CRITICAL": 0, "WARNING": 1, "NORMAL": 2}
    facility_health.sort(key=lambda x: (status_priority.get(x.status, 3), -x.low_stock_count, x.name))

    # Category Breakdown
    cat_units = defaultdict(int)
    cat_batches = defaultdict(int)
    cat_meds = defaultdict(set)

    for batch in batches:
        med = medicine_map.get(batch.medicine_id)
        if med:
            cat_units[med.category] += batch.quantity
            cat_batches[med.category] += 1
            cat_meds[med.category].add(med.id)

    category_distribution = [
        CategoryStockItem(
            category=cat,
            total_units=cat_units[cat],
            batch_count=cat_batches[cat],
            medicine_count=len(cat_meds[cat]),
        )
        for cat in sorted(cat_units.keys())
    ]

    # Recent Activity Feed (combining AuditLog and recent Consumption)
    activity_items: list[ActivityFeedItem] = []

    # Permitted facility IDs
    allowed_fac_ids = [f.id for f in facilities]

    # Scoped Audit Logs Query
    audit_query = select(AuditLog)
    if effective_facility_id:
        audit_query = audit_query.where(AuditLog.facility_id == effective_facility_id)
    elif effective_district_id:
        district_users = db.scalars(select(User.id).where(User.district_id == effective_district_id)).all()
        audit_query = audit_query.where(
            (AuditLog.facility_id.in_(allowed_fac_ids)) | (AuditLog.user_id.in_(district_users))
        )
    elif allowed_fac_ids:
        audit_query = audit_query.where(AuditLog.facility_id.in_(allowed_fac_ids))

    audit_logs = db.scalars(
        audit_query.order_by(desc(AuditLog.timestamp)).limit(15)
    ).all()

    user_ids = {a.user_id for a in audit_logs if a.user_id}
    users_by_id = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}

    for log in audit_logs:
        fac = facility_map.get(log.facility_id) if log.facility_id else None
        actor = users_by_id.get(log.user_id, "System User")
        activity_items.append(
            ActivityFeedItem(
                id=str(log.id),
                timestamp=log.timestamp,
                event_type="AUDIT",
                actor_name=actor,
                description=f"[{log.action}] {log.description}",
                facility_name=fac.name if fac else None,
            )
        )

    # If audit logs are few, fetch recent scoped consumption records
    if len(activity_items) < 5:
        cons_query = select(ConsumptionRecord)
        if effective_facility_id:
            cons_query = cons_query.where(ConsumptionRecord.facility_id == effective_facility_id)
        elif allowed_fac_ids:
            cons_query = cons_query.where(ConsumptionRecord.facility_id.in_(allowed_fac_ids))
        else:
            cons_query = cons_query.where(ConsumptionRecord.facility_id.is_(None))

        consumptions = db.scalars(
            cons_query.order_by(desc(ConsumptionRecord.created_at)).limit(10)
        ).all()
        for cr in consumptions:
            fac = facility_map.get(cr.facility_id) if cr.facility_id else None
            med = medicine_map.get(cr.medicine_id)
            activity_items.append(
                ActivityFeedItem(
                    id=str(cr.id),
                    timestamp=cr.created_at,
                    event_type="CONSUMPTION",
                    actor_name="Frontline Staff",
                    description=f"Recorded consumption: {cr.quantity_consumed} units of {med.name if med else 'Medicine'}",
                    facility_name=fac.name if fac else None,
                )
            )

    activity_items.sort(key=lambda x: x.timestamp, reverse=True)

    # Pending transfers (in Phase 3, this defaults to 0 since transfer table is implemented in Phase 9)
    pending_transfers_count = 0

    kpis = CommandCenterKPIs(
        total_facilities=len(facilities),
        total_medicines=total_medicines,
        total_inventory_units=total_inventory_units,
        low_stock_items_count=low_stock_items_count,
        expiring_soon_count=expiring_soon_count,
        critical_facilities_count=critical_facilities_count,
        pending_transfers_count=pending_transfers_count,
    )

    return CommandCenterResponse(
        kpis=kpis,
        facility_health=facility_health,
        expiry_alerts=expiry_alerts[:25],
        stock_alerts=stock_alerts[:30],
        category_distribution=category_distribution,
        recent_activity=activity_items[:15],
        as_of=now,
    )
