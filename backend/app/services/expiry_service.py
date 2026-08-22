import math
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine, Warehouse
from app.schemas.expiry import (
    BatchExpiryRisk,
    ExpiryAssessmentResponse,
    ExpiryEngineKPIs,
    ExpiryRescueOpportunity,
    RescuePriority,
    UrgencyTier,
)
from app.services.forecasting import extract_time_series


def evaluate_expiry_risks(
    db: Session,
    facility_id: uuid.UUID | None = None,
    district_id: uuid.UUID | None = None,
) -> ExpiryAssessmentResponse:
    """Evaluates batch-level expiry wastage risks and rescue opportunities using FEFO logic."""
    today = date.today()
    start_date = today - timedelta(days=90)

    # 1. Fetch facilities & warehouses
    fac_query = select(Facility)
    if facility_id:
        fac_query = fac_query.where(Facility.id == facility_id)
    elif district_id:
        fac_query = fac_query.where(Facility.district_id == district_id)
    facilities = db.scalars(fac_query).all()
    facility_map = {f.id: f for f in facilities}

    warehouses = db.scalars(select(Warehouse)).all()
    warehouse_map = {w.id: w for w in warehouses}

    medicines = db.scalars(select(Medicine)).all()
    medicine_map = {m.id: m for m in medicines}

    # 2. Fetch active unexpired or recently expiring inventory batches
    batch_query = select(InventoryBatch).where(InventoryBatch.expiry_date >= today)
    if facility_id:
        batch_query = batch_query.where(InventoryBatch.facility_id == facility_id)
    batches = db.scalars(batch_query.order_by(InventoryBatch.expiry_date.asc())).all()

    # 3. Fetch historical consumption records
    consumptions = db.scalars(
        select(ConsumptionRecord).where(ConsumptionRecord.date >= start_date)
    ).all()

    records_by_pair = defaultdict(list)
    for c in consumptions:
        records_by_pair[(c.facility_id, c.medicine_id)].append(c)

    # Calculate daily demand per facility-medicine pair
    daily_demands = {}
    for fac in facilities:
        for med in medicines:
            recs = records_by_pair[(fac.id, med.id)]
            df = extract_time_series(recs, start_date, today)
            recent_series = df["quantity"].tail(30)
            avg_daily = float(recent_series.mean()) if not recent_series.empty else 0.0
            daily_demands[(fac.id, med.id)] = round(max(0.0, avg_daily), 1)

    # Group batches by (facility_id, medicine_id) to apply FEFO (First Expiry, First Out)
    batches_by_pair = defaultdict(list)
    for b in batches:
        if b.facility_id and b.facility_id in facility_map:
            batches_by_pair[(b.facility_id, b.medicine_id)].append(b)

    batch_risks: list[BatchExpiryRisk] = []
    rescue_opportunities: list[ExpiryRescueOpportunity] = []

    expiring_soon_count = 0
    total_expiring_units = 0
    total_rescueable_surplus_units = 0
    fac_waste_scores = defaultdict(int)
    med_waste_scores = defaultdict(int)

    for (fac_id, med_id), pair_batches in batches_by_pair.items():
        fac = facility_map.get(fac_id)
        med = medicine_map.get(med_id)
        if not fac or not med:
            continue

        daily_demand = daily_demands.get((fac_id, med_id), 0.0)

        # Sort FEFO
        sorted_batches = sorted(pair_batches, key=lambda b: b.expiry_date)
        days_simulated = 0

        for b in sorted_batches:
            days_to_exp = max(0, (b.expiry_date - today).days)

            # Determine urgency tier
            if days_to_exp <= 30:
                urgency: UrgencyTier = "CRITICAL_30"
            elif days_to_exp <= 60:
                urgency: UrgencyTier = "WARNING_60"
            elif days_to_exp <= 90:
                urgency: UrgencyTier = "ATTENTION_90"
            else:
                urgency: UrgencyTier = "NORMAL"

            if days_to_exp <= 90:
                expiring_soon_count += 1
                total_expiring_units += b.quantity

            # FEFO Consumption calculation
            # Estimate how much of this batch will be consumed locally before expiry
            if daily_demand > 0:
                consumable_capacity = math.ceil(days_to_exp * daily_demand)
                expected_consumption = min(b.quantity, max(0, consumable_capacity - days_simulated * int(daily_demand)))
            else:
                expected_consumption = 0

            exp_surplus = max(0, b.quantity - expected_consumption)
            is_candidate = exp_surplus > 0 and days_to_exp <= 180

            if is_candidate:
                total_rescueable_surplus_units += exp_surplus
                fac_waste_scores[fac.name] += exp_surplus
                med_waste_scores[med.name] += exp_surplus

                priority: RescuePriority = "HIGH" if (days_to_exp <= 45 or exp_surplus >= 100) else "MEDIUM" if days_to_exp <= 90 else "LOW"
                reason = (
                    f"PHC/CHC excess batch {b.batch_number} has {exp_surplus} units unlikely to be consumed "
                    f"before expiry in {days_to_exp} days (daily dispensing velocity: {daily_demand}/day)."
                )

                rescue_opportunities.append(
                    ExpiryRescueOpportunity(
                        batch_id=b.id,
                        batch_number=b.batch_number,
                        source_facility_id=fac.id,
                        source_facility_name=fac.name,
                        medicine_id=med.id,
                        medicine_name=med.name,
                        category=med.category,
                        unit=med.unit,
                        batch_quantity=b.quantity,
                        expiry_date=b.expiry_date,
                        days_until_expiry=days_to_exp,
                        expected_local_consumption=expected_consumption,
                        rescueable_surplus=exp_surplus,
                        priority=priority,
                        reason=reason,
                    )
                )

            action = (
                f"FEFO Rescue Candidate: {exp_surplus} units available for inter-facility redistribution."
                if is_candidate
                else "FEFO On Track: Expected to be fully consumed locally prior to expiry."
            )

            batch_risks.append(
                BatchExpiryRisk(
                    batch_id=b.id,
                    batch_number=b.batch_number,
                    facility_id=fac.id,
                    facility_name=fac.name,
                    medicine_id=med.id,
                    medicine_name=med.name,
                    category=med.category,
                    unit=med.unit,
                    quantity=b.quantity,
                    expiry_date=b.expiry_date,
                    days_until_expiry=days_to_exp,
                    expected_daily_consumption=daily_demand,
                    expected_consumption_before_expiry=expected_consumption,
                    potential_expiring_surplus=exp_surplus,
                    urgency=urgency,
                    is_rescue_candidate=is_candidate,
                    recommended_action=action,
                )
            )

    # Sort risks: Candidates first, then by days_until_expiry ascending
    batch_risks.sort(key=lambda x: (not x.is_rescue_candidate, x.days_until_expiry, x.batch_number))
    rescue_opportunities.sort(key=lambda x: (0 if x.priority == "HIGH" else 1 if x.priority == "MEDIUM" else 2, x.days_until_expiry))

    most_vulnerable_fac = (
        sorted(fac_waste_scores.items(), key=lambda x: x[1], reverse=True)[0][0]
        if fac_waste_scores
        else None
    )
    most_vulnerable_med = (
        sorted(med_waste_scores.items(), key=lambda x: x[1], reverse=True)[0][0]
        if med_waste_scores
        else None
    )

    kpis = ExpiryEngineKPIs(
        total_batches_monitored=len(batch_risks),
        expiring_soon_count=expiring_soon_count,
        total_expiring_units=total_expiring_units,
        total_rescueable_surplus_units=total_rescueable_surplus_units,
        most_vulnerable_facility=most_vulnerable_fac,
        most_vulnerable_medicine=most_vulnerable_med,
    )

    return ExpiryAssessmentResponse(
        kpis=kpis,
        batch_risks=batch_risks,
        rescue_opportunities=rescue_opportunities,
        as_of=datetime.now(timezone.utc),
    )
