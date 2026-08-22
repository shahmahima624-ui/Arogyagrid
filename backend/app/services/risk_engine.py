import uuid
import math
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import ConsumptionRecord, District, Facility, InventoryBatch, Medicine
from app.schemas.risks import (
    RiskAssessmentResponse,
    RiskSummaryKPIs,
    RiskTier,
    StockoutRiskItem,
)
from app.services.forecasting import extract_time_series


def format_time_label(days: float) -> str:
    """Formats fractional days into readable countdown strings e.g. '2 days 9 hours'."""
    if days <= 0.0:
        return "Immediate Stockout"
    if days < 1.0:
        hours = max(1, int(days * 24))
        return f"{hours} hour{'s' if hours != 1 else ''}"
    if days < 7.0:
        d = int(days)
        h = int((days - d) * 24)
        if h > 0:
            return f"{d} day{'s' if d != 1 else ''} {h} hr{'s' if h != 1 else ''}"
        return f"{d} day{'s' if d != 1 else ''}"
    if days <= 30.0:
        return f"{round(days, 1)} days"
    return f"{round(days, 0):.0f} days"


def evaluate_stockout_risks(
    db: Session,
    facility_id: uuid.UUID | None = None,
    district_id: uuid.UUID | None = None,
    critical_threshold_days: float = 3.0,
    high_risk_threshold_days: float = 7.0,
    at_risk_threshold_days: float = 14.0,
) -> RiskAssessmentResponse:
    """Evaluates dynamic stockout risks across facility-medicine nodes."""
    today = date.today()
    start_date = today - timedelta(days=90)

    # 1. Fetch facilities
    fac_query = select(Facility)
    if facility_id:
        fac_query = fac_query.where(Facility.id == facility_id)
    elif district_id:
        fac_query = fac_query.where(Facility.district_id == district_id)
    facilities = db.scalars(fac_query.order_by(Facility.name)).all()
    facility_map = {f.id: f for f in facilities}

    # Fetch districts
    districts = db.scalars(select(District)).all()
    district_map = {d.id: d.name for d in districts}

    # 2. Fetch catalog medicines
    medicines = db.scalars(select(Medicine).order_by(Medicine.name)).all()

    # 3. Fetch active unexpired batches
    batches = db.scalars(
        select(InventoryBatch).where(InventoryBatch.expiry_date >= today)
    ).all()

    usable_stocks = defaultdict(int)
    batches_by_pair = defaultdict(list)
    for b in batches:
        if b.facility_id:
            usable_stocks[(b.facility_id, b.medicine_id)] += b.quantity
            batches_by_pair[(b.facility_id, b.medicine_id)].append(b)

    # 4. Fetch historical consumption records
    consumptions = db.scalars(
        select(ConsumptionRecord).where(ConsumptionRecord.date >= start_date)
    ).all()

    records_by_pair = defaultdict(list)
    for c in consumptions:
        records_by_pair[(c.facility_id, c.medicine_id)].append(c)

    risk_items: list[StockoutRiskItem] = []
    critical_count = 0
    high_risk_count = 0
    at_risk_count = 0
    healthy_count = 0

    facility_vulnerability_scores = defaultdict(int)
    medicine_vulnerability_scores = defaultdict(int)

    for fac in facilities:
        district_name = district_map.get(fac.district_id, "District Network")

        # Lead times & Safety stock multipliers based on facility tier
        if fac.facility_type == "PHC":
            lead_time_days = 2
            safety_days = 3
        elif fac.facility_type == "CHC":
            lead_time_days = 3
            safety_days = 5
        else:
            lead_time_days = 5
            safety_days = 7

        for med in medicines:
            curr_stock = usable_stocks[(fac.id, med.id)]
            recs = records_by_pair[(fac.id, med.id)]

            # Compute predicted daily demand
            df = extract_time_series(recs, start_date, today)
            recent_series = df["quantity"].tail(30)
            avg_daily = float(recent_series.mean()) if not recent_series.empty else 0.0

            # Weight slightly by most recent 7-day velocity if available
            recent_7d = float(df["quantity"].tail(7).mean()) if len(df) >= 7 else avg_daily
            if recent_7d > 0 and avg_daily > 0:
                pred_daily_demand = round(0.6 * recent_7d + 0.4 * avg_daily, 1)
            else:
                pred_daily_demand = round(avg_daily, 1)

            # Calculate days to stockout
            if pred_daily_demand <= 0.0:
                if curr_stock == 0:
                    days_to_stockout = 0.0
                    risk_level = RiskTier.CRITICAL
                    action = "Zero stock on catalog medicine. Submit stock request."
                else:
                    days_to_stockout = 999.0
                    risk_level = RiskTier.HEALTHY
                    action = "Stock levels stable with zero current consumption."
            else:
                # Continuous depletion with batch expiry simulation
                active_batches = sorted(batches_by_pair[(fac.id, med.id)], key=lambda x: x.expiry_date)
                sim_stock = curr_stock
                depleted_at = None

                for day_step in range(1, 91):
                    # Deplete demand
                    sim_stock -= pred_daily_demand
                    if sim_stock <= 0:
                        prev_stock = sim_stock + pred_daily_demand
                        fraction = prev_stock / pred_daily_demand if pred_daily_demand > 0 else 0.0
                        depleted_at = (day_step - 1) + max(0.0, min(1.0, fraction))
                        break

                if depleted_at is not None:
                    days_to_stockout = round(depleted_at, 1)
                else:
                    days_to_stockout = round(curr_stock / pred_daily_demand, 1)

                # Determine Risk Tier
                if days_to_stockout < critical_threshold_days or curr_stock == 0:
                    risk_level = RiskTier.CRITICAL
                    action = "Initiate emergency inter-facility stock transfer immediately."
                elif days_to_stockout < high_risk_threshold_days:
                    risk_level = RiskTier.HIGH_RISK
                    action = "Schedule central warehouse replenishment within 48 hours."
                elif days_to_stockout < at_risk_threshold_days:
                    risk_level = RiskTier.AT_RISK
                    action = "Monitor dispensing velocity and prepare routine reorder."
                else:
                    risk_level = RiskTier.HEALTHY
                    action = "Stock levels adequate. Maintain standard FEFO dispensing."

            # Update KPI counts
            if risk_level == RiskTier.CRITICAL:
                critical_count += 1
                facility_vulnerability_scores[fac.name] += 3
                medicine_vulnerability_scores[med.name] += 3
            elif risk_level == RiskTier.HIGH_RISK:
                high_risk_count += 1
                facility_vulnerability_scores[fac.name] += 2
                medicine_vulnerability_scores[med.name] += 2
            elif risk_level == RiskTier.AT_RISK:
                at_risk_count += 1
                facility_vulnerability_scores[fac.name] += 1
                medicine_vulnerability_scores[med.name] += 1
            else:
                healthy_count += 1

            stockout_label = format_time_label(days_to_stockout)
            proj_date = today + timedelta(days=int(days_to_stockout)) if days_to_stockout < 90 else None
            safety_stock_req = int(math.ceil(pred_daily_demand * safety_days))

            # Confidence score (0.75 to 0.95) based on consumption record volume
            conf = min(0.95, max(0.70, round(0.70 + (len(recs) / 90.0) * 0.25, 2)))

            risk_items.append(
                StockoutRiskItem(
                    facility_id=fac.id,
                    facility_name=fac.name,
                    facility_type=fac.facility_type,
                    district_name=district_name,
                    medicine_id=med.id,
                    medicine_name=med.name,
                    category=med.category,
                    current_usable_stock=curr_stock,
                    predicted_daily_demand=pred_daily_demand,
                    days_to_stockout=days_to_stockout,
                    stockout_time_label=stockout_label,
                    projected_stockout_date=proj_date,
                    risk_level=risk_level,
                    safety_stock_required=safety_stock_req,
                    lead_time_days=lead_time_days,
                    confidence_score=conf,
                    recommended_action=action,
                )
            )

    # Sort risk items: CRITICAL first, then HIGH_RISK, then AT_RISK, then HEALTHY, sorted by shortest days
    tier_order = {RiskTier.CRITICAL: 0, RiskTier.HIGH_RISK: 1, RiskTier.AT_RISK: 2, RiskTier.HEALTHY: 3}
    risk_items.sort(key=lambda x: (tier_order[x.risk_level], x.days_to_stockout, x.medicine_name))

    most_vulnerable_fac = (
        sorted(facility_vulnerability_scores.items(), key=lambda x: x[1], reverse=True)[0][0]
        if facility_vulnerability_scores
        else None
    )
    most_vulnerable_med = (
        sorted(medicine_vulnerability_scores.items(), key=lambda x: x[1], reverse=True)[0][0]
        if medicine_vulnerability_scores
        else None
    )

    kpis = RiskSummaryKPIs(
        critical_count=critical_count,
        high_risk_count=high_risk_count,
        at_risk_count=at_risk_count,
        healthy_count=healthy_count,
        most_vulnerable_facility=most_vulnerable_fac,
        most_vulnerable_medicine=most_vulnerable_med,
        total_monitored_pairs=len(risk_items),
    )

    return RiskAssessmentResponse(
        kpis=kpis,
        risks=risk_items,
        as_of=datetime.now(timezone.utc),
    )


def compute_risk_for_facility_medicine(
    db: Session, facility: Facility, medicine: Medicine
) -> StockoutRiskItem | None:
    """
    Lightweight single-pair risk computation used by the redistribution engine.
    Returns a StockoutRiskItem or None if no data is available.
    """
    today = date.today()
    start_date = today - timedelta(days=90)

    batches = db.scalars(
        select(InventoryBatch).where(
            InventoryBatch.facility_id == facility.id,
            InventoryBatch.medicine_id == medicine.id,
            InventoryBatch.expiry_date >= today,
        )
    ).all()
    curr_stock = sum(b.quantity for b in batches)

    recs = db.scalars(
        select(ConsumptionRecord).where(
            ConsumptionRecord.facility_id == facility.id,
            ConsumptionRecord.medicine_id == medicine.id,
            ConsumptionRecord.date >= start_date,
        )
    ).all()

    df = extract_time_series(list(recs), start_date, today)
    series_30 = df["quantity"].tail(30)
    avg_daily = float(series_30.mean()) if not series_30.empty else 0.0
    series_7 = df["quantity"].tail(7)
    recent_7d = float(series_7.mean()) if len(df) >= 7 else avg_daily
    if recent_7d > 0 and avg_daily > 0:
        pred_daily = round(0.6 * recent_7d + 0.4 * avg_daily, 1)
    else:
        pred_daily = round(avg_daily, 1)

    if pred_daily <= 0.0:
        days_to_stockout = 0.0 if curr_stock == 0 else 999.0
    else:
        sim = curr_stock
        depleted = None
        for step in range(1, 91):
            sim -= pred_daily
            if sim <= 0:
                prev = sim + pred_daily
                depleted = (step - 1) + max(0.0, min(1.0, prev / pred_daily))
                break
        days_to_stockout = round(depleted, 1) if depleted is not None else round(curr_stock / pred_daily, 1)

    if facility.facility_type == "PHC":
        lead_time_days, safety_days = 2, 3
    elif facility.facility_type == "CHC":
        lead_time_days, safety_days = 3, 5
    else:
        lead_time_days, safety_days = 5, 7

    if days_to_stockout < 3.0 or curr_stock == 0:
        risk_level = RiskTier.CRITICAL
        action = "Emergency transfer required."
    elif days_to_stockout < 7.0:
        risk_level = RiskTier.HIGH_RISK
        action = "Schedule replenishment within 48 hours."
    elif days_to_stockout < 14.0:
        risk_level = RiskTier.AT_RISK
        action = "Monitor and prepare reorder."
    else:
        risk_level = RiskTier.HEALTHY
        action = "Stock levels adequate."

    conf = min(0.95, max(0.70, round(0.70 + (len(list(recs)) / 90.0) * 0.25, 2)))
    proj_date = today + timedelta(days=int(days_to_stockout)) if days_to_stockout < 90 else None

    return StockoutRiskItem(
        facility_id=facility.id,
        facility_name=facility.name,
        facility_type=facility.facility_type,
        district_name="",
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        category=medicine.category,
        current_usable_stock=curr_stock,
        predicted_daily_demand=pred_daily,
        days_to_stockout=days_to_stockout,
        stockout_time_label=format_time_label(days_to_stockout),
        projected_stockout_date=proj_date,
        risk_level=risk_level,
        safety_stock_required=int(math.ceil(pred_daily * safety_days)),
        lead_time_days=lead_time_days,
        confidence_score=conf,
        recommended_action=action,
    )

