"""Deterministic daily consumption aggregation and feature engineering."""

import math
import uuid
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import ConsumptionRecord, InventoryBatch
from app.schemas.consumption_intelligence import (
    ConsumptionIntelligenceOut,
    ConsumptionIntelligenceSummary,
    ConsumptionTimeSeriesPoint,
)


def _mean(values: list[int]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _population_stddev(values: list[int]) -> float:
    if not values:
        return 0.0
    average = sum(values) / len(values)
    return round(math.sqrt(sum((value - average) ** 2 for value in values) / len(values)), 2)


def build_consumption_intelligence(
    db: Session,
    facility_id: uuid.UUID,
    medicine_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> ConsumptionIntelligenceOut:
    """Build a gap-filled facility-medicine time series suitable for future ML.

    The function deliberately performs no forecasting: it exposes only observed
    consumption, deterministic rolling features, and the current usable stock.
    """
    records = db.scalars(
        select(ConsumptionRecord).where(
            ConsumptionRecord.facility_id == facility_id,
            ConsumptionRecord.medicine_id == medicine_id,
            ConsumptionRecord.date >= start_date,
            ConsumptionRecord.date <= end_date,
        )
    ).all()
    daily: dict[date, dict[str, int]] = defaultdict(lambda: {"quantity": 0, "patients": 0})
    for record in records:
        daily[record.date]["quantity"] += record.quantity_consumed
        daily[record.date]["patients"] += record.patient_count or 0

    current_stock = db.scalars(
        select(InventoryBatch.quantity).where(
            InventoryBatch.facility_id == facility_id,
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.expiry_date > date.today(),
        )
    ).all()
    usable_stock = sum(current_stock)

    dates: list[date] = []
    cursor = start_date
    while cursor <= end_date:
        dates.append(cursor)
        cursor += timedelta(days=1)
    quantities = [daily[day]["quantity"] for day in dates]

    series: list[ConsumptionTimeSeriesPoint] = []
    for index, day in enumerate(dates):
        previous_7 = quantities[max(0, index - 7) : index]
        previous_14 = quantities[max(0, index - 14) : index]
        series.append(
            ConsumptionTimeSeriesPoint(
                date=day,
                quantity_consumed=quantities[index],
                patient_count=daily[day]["patients"],
                lag_1=quantities[index - 1] if index >= 1 else None,
                lag_7=quantities[index - 7] if index >= 7 else None,
                lag_14=quantities[index - 14] if index >= 14 else None,
                rolling_mean_7=_mean(previous_7) if previous_7 else None,
                rolling_mean_14=_mean(previous_14) if previous_14 else None,
                rolling_std_7=_population_stddev(previous_7) if previous_7 else None,
                day_of_week=day.weekday(),
                month=day.month,
                current_stock=usable_stock,
            )
        )

    recent = quantities[-7:]
    previous = quantities[-14:-7]
    recent_average, previous_average = _mean(recent), _mean(previous)
    change = None if previous_average == 0 else round(((recent_average - previous_average) / previous_average) * 100, 1)
    summary = ConsumptionIntelligenceSummary(
        facility_id=facility_id,
        medicine_id=medicine_id,
        from_date=start_date,
        to_date=end_date,
        days_with_recorded_consumption=len(daily),
        total_consumption=sum(quantities),
        average_daily_demand=_mean(quantities),
        recent_7_day_average=recent_average,
        previous_7_day_average=previous_average,
        recent_demand_change_percent=change,
        current_usable_stock=usable_stock,
    )
    return ConsumptionIntelligenceOut(summary=summary, series=series)
