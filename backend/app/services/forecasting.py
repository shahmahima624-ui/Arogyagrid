import uuid
import math
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import ConsumptionRecord, Facility, InventoryBatch, Medicine
from app.schemas.forecasts import (
    DailyConsumptionPoint,
    FacilityMedicineForecastDetail,
    ForecastPoint,
    MedicineForecastSummary,
    ModelEvaluationMetrics,
    RollingAverageAnalytics,
)


def extract_time_series(
    records: list[ConsumptionRecord],
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    """Creates a daily continuous time series dataframe from sparse consumption records."""
    # Build date index
    date_range = pd.date_range(start=start_date, end=end_date, freq="D")
    df = pd.DataFrame({"date": date_range.date})
    df["date"] = pd.to_datetime(df["date"])

    # Aggregate records by date
    daily_sums = defaultdict(lambda: {"quantity": 0, "patient_count": 0, "count": 0})
    for r in records:
        r_date = getattr(r, "date", getattr(r, "consumption_date", None))
        if r_date:
            daily_sums[r_date]["quantity"] += r.quantity_consumed
            if r.patient_count:
                daily_sums[r_date]["patient_count"] += r.patient_count
                daily_sums[r_date]["count"] += 1

    records_df = pd.DataFrame(
        [
            {
                "date": pd.to_datetime(d),
                "quantity": v["quantity"],
                "patient_count": int(v["patient_count"] / max(v["count"], 1)) if v["count"] > 0 else 0,
            }
            for d, v in daily_sums.items()
        ]
    )

    if not records_df.empty:
        df = pd.merge(df, records_df, on="date", how="left")
        df["quantity"] = df["quantity"].fillna(0).astype(float)
        df["patient_count"] = df["patient_count"].fillna(0).astype(float)
    else:
        df["quantity"] = 0.0
        df["patient_count"] = 0.0

    return df.sort_values("date").reset_index(drop=True)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Builds lag, rolling statistical, and calendar features (Phase 4)."""
    data = df.copy()
    data["day_of_week"] = data["date"].dt.dayofweek
    data["month"] = data["date"].dt.month
    data["is_weekend"] = (data["day_of_week"] >= 5).astype(int)

    # Lags
    data["lag_1"] = data["quantity"].shift(1)
    data["lag_7"] = data["quantity"].shift(7)
    data["lag_14"] = data["quantity"].shift(14)

    # Rolling window metrics
    data["rolling_mean_7"] = data["quantity"].shift(1).rolling(window=7, min_periods=1).mean()
    data["rolling_mean_14"] = data["quantity"].shift(1).rolling(window=14, min_periods=1).mean()
    data["rolling_std_7"] = data["quantity"].shift(1).rolling(window=7, min_periods=1).std().fillna(0)

    return data


def train_and_forecast_item(
    facility_id: uuid.UUID,
    facility_name: str,
    medicine_id: uuid.UUID,
    medicine_name: str,
    category: str,
    current_stock: int,
    consumption_records: list[ConsumptionRecord],
    horizon_days: int = 14,
) -> tuple[MedicineForecastSummary, FacilityMedicineForecastDetail]:
    """Trains baseline vs ML models, evaluates error metrics, and projects forward demand."""
    today = date.today()
    start_date = today - timedelta(days=90)

    # 1. Build continuous series
    df = extract_time_series(consumption_records, start_date, today)

    # Historical points with 7-day rolling average
    df["rolling_7d_raw"] = df["quantity"].rolling(window=7, min_periods=1).mean()
    historical_points = [
        DailyConsumptionPoint(
            date=row["date"].date(),
            quantity=int(row["quantity"]),
            patient_count=int(row["patient_count"]) if row["patient_count"] > 0 else None,
            rolling_7d_avg=round(float(row["rolling_7d_raw"]), 1),
        )
        for _, row in df.iterrows()
    ]

    avg_historical = float(df["quantity"].mean()) if not df.empty else 0.0

    # 2. Feature engineering
    feature_df = engineer_features(df)
    feature_cols = [
        "day_of_week",
        "month",
        "is_weekend",
        "lag_1",
        "lag_7",
        "lag_14",
        "rolling_mean_7",
        "rolling_mean_14",
        "rolling_std_7",
        "patient_count",
    ]

    valid_df = feature_df.dropna().reset_index(drop=True)

    model_name = "GradientBoostingRegressor"
    mae: float | None = None
    rmse: float | None = None
    mape: float | None = None
    r2_score: float | None = None
    residual_std = 3.0
    evaluation_available = True

    if len(valid_df) >= 20 and avg_historical > 0:
        X = valid_df[feature_cols].values
        y = valid_df["quantity"].values

        # Split into train / test (last 14 days as test)
        test_size = min(14, len(valid_df) // 4)
        X_train, X_test = X[:-test_size], X[-test_size:]
        y_train, y_test = y[:-test_size], y[-test_size:]

        # Train Gradient Boosting Regressor
        model = GradientBoostingRegressor(n_estimators=60, max_depth=3, learning_rate=0.08, random_state=42)
        model.fit(X_train, y_train)

        # Predictions on test split
        y_pred = np.maximum(0, model.predict(X_test))

        from sklearn.metrics import r2_score as calc_r2
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(math.sqrt(mean_squared_error(y_test, y_pred)))
        
        # MAPE with division safety
        denom = np.maximum(y_test, 1.0)
        mape = float(np.mean(np.abs(y_test - y_pred) / denom) * 100)
        r2_score = float(max(0.0, calc_r2(y_test, y_pred)))

        # Residual standard error
        residuals = y_test - y_pred
        residual_std = float(np.std(residuals)) if len(residuals) > 1 else 2.0

        # Refit on full dataset
        model.fit(X, y)
    else:
        # Fallback to Exponential Moving Average
        # Not enough data for held-out evaluation — metrics not fabricated.
        model_name = "ExponentialMovingAverage"
        evaluation_available = False
        # residual_std still used for uncertainty bands during forecasting
        residual_std = max(1.5, avg_historical * 0.15) if avg_historical > 0 else 3.0

    # 3. Autoregressive Horizon Forecasting
    forecast_points: list[ForecastPoint] = []
    current_series = list(df["quantity"].values)
    current_dates = list(df["date"].values)

    for step in range(1, horizon_days + 1):
        target_date = today + timedelta(days=step)
        target_dt = pd.to_datetime(target_date)

        # Compute autoregressive features from updated series
        l1 = current_series[-1] if len(current_series) >= 1 else avg_historical
        l7 = current_series[-7] if len(current_series) >= 7 else avg_historical
        l14 = current_series[-14] if len(current_series) >= 14 else avg_historical
        rm7 = float(np.mean(current_series[-7:])) if len(current_series) >= 7 else avg_historical
        rm14 = float(np.mean(current_series[-14:])) if len(current_series) >= 14 else avg_historical
        rstd7 = float(np.std(current_series[-7:])) if len(current_series) >= 7 else 0.0

        feat_vector = np.array(
            [
                target_dt.dayofweek,
                target_dt.month,
                1 if target_dt.dayofweek >= 5 else 0,
                l1,
                l7,
                l14,
                rm7,
                rm14,
                rstd7,
                float(np.mean(df["patient_count"].tail(7))) if not df.empty else 0.0,
            ]
        ).reshape(1, -1)

        if model_name == "GradientBoostingRegressor":
            pred_val = float(np.maximum(0, model.predict(feat_vector)[0]))
        else:
            # Moving average with day-of-week seasonality dampener
            dow_mult = 0.7 if target_dt.dayofweek >= 5 else 1.1
            pred_val = max(0.0, float(rm7 * dow_mult))

        # Append to series for subsequent steps
        current_series.append(pred_val)
        current_dates.append(target_dt)

        # Uncertainty bounds (expanding with horizon)
        uncertainty = 1.96 * residual_std * math.sqrt(1 + 0.05 * step)
        lower_bound = max(0.0, round(pred_val - uncertainty, 1))
        upper_bound = round(pred_val + uncertainty, 1)

        forecast_points.append(
            ForecastPoint(
                date=target_date,
                predicted_quantity=round(pred_val, 1),
                lower_bound=lower_bound,
                upper_bound=upper_bound,
            )
        )

    # 4. Aggregates & Confidence
    pred_daily_avg = float(np.mean([p.predicted_quantity for p in forecast_points])) if forecast_points else avg_historical
    pred_7d = sum(p.predicted_quantity for p in forecast_points[:7])
    pred_14d = sum(p.predicted_quantity for p in forecast_points[:14])
    pred_30d = pred_daily_avg * 30

    # Confidence score: derived from MAPE when evaluation is available
    # For EMA/insufficient data: cap at 0.65 (low data confidence)
    if evaluation_available and mape is not None:
        confidence = max(0.60, min(0.98, round(1.0 - (mape / 100.0) * 0.5, 2)))
    else:
        confidence = 0.60  # LOW DATA CONFIDENCE — insufficient history

    # Stockout risk in days
    days_to_stockout = None
    if pred_daily_avg > 0:
        days_to_stockout = round(current_stock / pred_daily_avg, 1)

    now_utc = datetime.now(timezone.utc)

    metrics = ModelEvaluationMetrics(
        model_name=model_name,
        evaluation_available=evaluation_available,
        mae=round(mae, 2) if mae is not None else None,
        rmse=round(rmse, 2) if rmse is not None else None,
        mape=round(mape, 1) if mape is not None else None,
        r2_score=round(r2_score, 2) if r2_score is not None else None,
        sample_count=len(df),
        training_date=now_utc,
    )

    summary = MedicineForecastSummary(
        facility_id=facility_id,
        facility_name=facility_name,
        medicine_id=medicine_id,
        medicine_name=medicine_name,
        category=category,
        current_stock=current_stock,
        avg_daily_historical=round(avg_historical, 1),
        predicted_daily_demand=round(pred_daily_avg, 1),
        predicted_7d_demand=round(pred_7d, 1),
        predicted_14d_demand=round(pred_14d, 1),
        predicted_30d_demand=round(pred_30d, 1),
        confidence_score=confidence,
        model_name=model_name,
        mape=round(mape, 1) if mape is not None else None,
        days_to_stockout=days_to_stockout,
    )

    detail = FacilityMedicineForecastDetail(
        facility_id=facility_id,
        facility_name=facility_name,
        medicine_id=medicine_id,
        medicine_name=medicine_name,
        category=category,
        current_stock=current_stock,
        historical_points=historical_points[-45:],  # Return recent 45 days for optimal charting
        forecast_points=forecast_points,
        metrics=metrics,
        predicted_daily_demand=round(pred_daily_avg, 1),
        avg_daily_historical=round(avg_historical, 1),
        confidence_score=confidence,
        horizon_days=horizon_days,
    )

    return summary, detail


def compute_consumption_analytics(db: Session, facility_id: uuid.UUID | None = None) -> list[RollingAverageAnalytics]:
    """Phase 4 analytics: rolling averages, velocity, and weekly demand trend."""
    today = date.today()
    start_date = today - timedelta(days=60)

    fac_query = select(Facility)
    if facility_id:
        fac_query = fac_query.where(Facility.id == facility_id)
    facilities = db.scalars(fac_query).all()
    facility_map = {f.id: f for f in facilities}

    medicines = db.scalars(select(Medicine)).all()
    medicine_map = {m.id: m for m in medicines}

    # Fetch inventory stocks
    batches = db.scalars(select(InventoryBatch)).all()
    stocks = defaultdict(int)
    for b in batches:
        if b.facility_id and b.expiry_date >= today:
            stocks[(b.facility_id, b.medicine_id)] += b.quantity

    # Fetch consumption records
    consumptions = db.scalars(
        select(ConsumptionRecord).where(ConsumptionRecord.date >= start_date)
    ).all()

    records_grouped = defaultdict(list)
    for c in consumptions:
        records_grouped[(c.facility_id, c.medicine_id)].append(c)

    results: list[RollingAverageAnalytics] = []

    for fac in facilities:
        for med in medicines:
            recs = records_grouped[(fac.id, med.id)]
            df = extract_time_series(recs, start_date, today)

            curr_stock = stocks[(fac.id, med.id)]

            # 7d, 14d, 30d averages
            avg_7d = float(df["quantity"].tail(7).mean()) if len(df) >= 7 else float(df["quantity"].mean())
            avg_14d = float(df["quantity"].tail(14).mean()) if len(df) >= 14 else float(df["quantity"].mean())
            avg_30d = float(df["quantity"].tail(30).mean()) if len(df) >= 30 else float(df["quantity"].mean())

            # Prior 7d for trend calculation
            prior_7d = float(df["quantity"].iloc[-14:-7].mean()) if len(df) >= 14 else avg_7d
            trend_pct = 0.0
            if prior_7d > 0:
                trend_pct = round(((avg_7d - prior_7d) / prior_7d) * 100, 1)

            days_remaining = round(curr_stock / avg_7d, 1) if avg_7d > 0 else None

            results.append(
                RollingAverageAnalytics(
                    facility_id=fac.id,
                    facility_name=fac.name,
                    medicine_id=med.id,
                    medicine_name=med.name,
                    category=med.category,
                    current_stock=curr_stock,
                    avg_daily_7d=round(avg_7d, 1),
                    avg_daily_14d=round(avg_14d, 1),
                    avg_daily_30d=round(avg_30d, 1),
                    weekly_trend_pct=trend_pct,
                    days_of_stock_remaining=days_remaining,
                )
            )

    results.sort(key=lambda x: (x.days_of_stock_remaining is None, x.days_of_stock_remaining or 999))
    return results
