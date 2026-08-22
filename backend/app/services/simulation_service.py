import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core import ConsumptionRecord, Facility, InventoryBatch, Medicine
from app.schemas.simulation import (
    FacilitySimulationImpact,
    PreventiveTransferProposal,
    SimulationResultResponse,
    SimulationScenario,
    SimulationSummary,
)


def run_stress_simulation(
    db: Session,
    scenario: SimulationScenario,
) -> SimulationResultResponse:
    today = date.today()

    # 1. Fetch facilities
    fac_query = select(Facility).where(Facility.status == "ACTIVE")
    if scenario.district_id:
        fac_query = fac_query.where(Facility.district_id == scenario.district_id)
    facilities = db.scalars(fac_query).all()

    # 2. Fetch medicines
    med_query = select(Medicine)
    if scenario.medicine_id:
        med_query = med_query.where(Medicine.id == scenario.medicine_id)
    elif scenario.medicine_name_filter:
        med_query = med_query.where(Medicine.name.ilike(f"%{scenario.medicine_name_filter}%"))
    elif scenario.medicine_category and scenario.medicine_category != "All":
        med_query = med_query.where(Medicine.category == scenario.medicine_category)

    medicines = db.scalars(med_query).all()

    facility_impacts: list[FacilitySimulationImpact] = []
    preventive_transfers: list[PreventiveTransferProposal] = []

    total_emergency_needed = 0
    newly_critical_count = 0
    accelerated_days_list: list[int] = []

    # Map medicine_id -> list of (facility, current_stock, daily_demand) for transfer matching
    surplus_pool: list[dict[str, Any]] = []
    shortage_pool: list[dict[str, Any]] = []

    multiplier = 1.0 + (scenario.demand_increase_percentage / 100.0)

    for fac in facilities:
        for med in medicines:
            # Current stock across batches
            batches = db.scalars(
                select(InventoryBatch).where(
                    InventoryBatch.facility_id == fac.id,
                    InventoryBatch.medicine_id == med.id,
                    InventoryBatch.expiry_date >= today,
                )
            ).all()

            current_stock = sum(b.quantity for b in batches)
            if current_stock == 0 and len(batches) == 0:
                continue

            # Average daily consumption in past 30 days
            cutoff = today - timedelta(days=30)
            avg_consumed = db.scalar(
                select(func.avg(ConsumptionRecord.quantity_consumed)).where(
                    ConsumptionRecord.facility_id == fac.id,
                    ConsumptionRecord.medicine_id == med.id,
                    ConsumptionRecord.date >= cutoff,
                )
            )
            baseline_daily = float(avg_consumed) if avg_consumed and float(avg_consumed) > 0 else 10.0
            simulated_daily = baseline_daily * multiplier

            # Days to stockout
            base_dts = current_stock / baseline_daily if baseline_daily > 0 else 999.0
            sim_dts = current_stock / simulated_daily if simulated_daily > 0 else 999.0

            # Supply delay shift
            effective_sim_dts = max(0.0, sim_dts - scenario.supply_delay_days)

            base_stockout_date = today + timedelta(days=int(base_dts))
            sim_stockout_date = today + timedelta(days=int(effective_sim_dts))

            accel_days = max(0, (base_stockout_date - sim_stockout_date).days)
            if accel_days > 0:
                accelerated_days_list.append(accel_days)

            # Risk levels
            if effective_sim_dts <= 3:
                risk_level = "CRITICAL"
            elif effective_sim_dts <= 7:
                risk_level = "HIGH"
            elif effective_sim_dts <= 14:
                risk_level = "MEDIUM"
            else:
                risk_level = "STABLE"

            # Check if newly critical under simulation
            if base_dts > 7 and effective_sim_dts <= 7:
                newly_critical_count += 1

            # Emergency stock needed to maintain 14 days safety under simulation
            target_14_day_stock = int(simulated_daily * 14)
            emergency_buffer = max(0, target_14_day_stock - current_stock)
            total_emergency_needed += emergency_buffer

            impact = FacilitySimulationImpact(
                facility_id=fac.id,
                facility_name=fac.name,
                facility_type=fac.facility_type,
                medicine_id=med.id,
                medicine_name=med.name,
                current_stock=current_stock,
                baseline_daily_demand=round(baseline_daily, 1),
                simulated_daily_demand=round(simulated_daily, 1),
                baseline_days_to_stockout=round(base_dts, 1),
                simulated_days_to_stockout=round(effective_sim_dts, 1),
                stockout_date_baseline=base_stockout_date,
                stockout_date_simulated=sim_stockout_date,
                days_stockout_accelerated=accel_days,
                emergency_stock_required=emergency_buffer,
                risk_level=risk_level,
            )
            facility_impacts.append(impact)

            # Categorize into surplus/shortage pools for preventive transfers
            if effective_sim_dts < 7 and emergency_buffer > 0:
                shortage_pool.append({
                    "facility_id": fac.id,
                    "facility_name": fac.name,
                    "medicine_id": med.id,
                    "medicine_name": med.name,
                    "needed": emergency_buffer,
                })
            elif effective_sim_dts > 30 and current_stock > 200:
                safe_surplus = int(current_stock - (simulated_daily * 20))
                if safe_surplus > 0:
                    surplus_pool.append({
                        "facility_id": fac.id,
                        "facility_name": fac.name,
                        "medicine_id": med.id,
                        "medicine_name": med.name,
                        "surplus": safe_surplus,
                    })

    # Match preventive transfers
    for s in shortage_pool:
        matching_surplus = [
            sp for sp in surplus_pool
            if sp["medicine_id"] == s["medicine_id"] and sp["facility_id"] != s["facility_id"] and sp["surplus"] > 0
        ]
        if matching_surplus:
            src = matching_surplus[0]
            transfer_qty = min(s["needed"], src["surplus"])
            src["surplus"] -= transfer_qty

            preventive_transfers.append(
                PreventiveTransferProposal(
                    source_facility_id=src["facility_id"],
                    source_facility_name=src["facility_name"],
                    destination_facility_id=s["facility_id"],
                    destination_facility_name=s["facility_name"],
                    medicine_name=s["medicine_name"],
                    recommended_transfer_qty=transfer_qty,
                    prevents_stockout=True,
                )
            )

    # Build 30-day projection chart data (day 0 to day 30)
    chart_data: list[dict[str, Any]] = []
    total_baseline_stock = sum(i.current_stock for i in facility_impacts)
    total_baseline_daily = sum(i.baseline_daily_demand for i in facility_impacts)
    total_simulated_daily = sum(i.simulated_daily_demand for i in facility_impacts)

    for day in range(0, 31, 3):
        base_proj = max(0, int(total_baseline_stock - (total_baseline_daily * day)))
        sim_proj = max(0, int(total_baseline_stock - (total_simulated_daily * day)))

        chart_data.append({
            "day": f"Day {day}",
            "baseline_stock": base_proj,
            "simulated_stock": sim_proj,
            "gap": base_proj - sim_proj,
        })

    avg_accel = (
        sum(accelerated_days_list) / len(accelerated_days_list)
        if accelerated_days_list
        else 0.0
    )

    summary = SimulationSummary(
        total_facilities_affected=len(facility_impacts),
        facilities_newly_critical=newly_critical_count,
        total_emergency_stock_needed=total_emergency_needed,
        avg_days_stockout_accelerated=round(avg_accel, 1),
    )

    return SimulationResultResponse(
        scenario=scenario,
        executed_at=datetime.now(timezone.utc),
        summary=summary,
        facility_impacts=facility_impacts,
        preventive_transfers=preventive_transfers,
        chart_data=chart_data,
    )
