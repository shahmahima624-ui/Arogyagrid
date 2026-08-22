"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "../../../components/page-header";
import { StatusBadge } from "../../../components/status-badge";
import { TableSkeleton, EmptyState, ErrorState } from "../../../components/skeletons";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  Cpu,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface DailyConsumptionPoint {
  date: string;
  quantity: number;
  patient_count?: number | null;
  rolling_7d_avg?: number | null;
}

interface ForecastPoint {
  date: string;
  predicted_quantity: number;
  lower_bound: number;
  upper_bound: number;
}

interface ModelEvaluationMetrics {
  model_name: string;
  evaluation_available?: boolean;
  mae?: number | null;
  rmse?: number | null;
  mape?: number | null;
  r2_score?: number | null;
  sample_count: number;
  training_date: string;
}

interface FacilityMedicineForecastDetail {
  facility_id: string;
  facility_name: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  current_stock: number;
  historical_points: DailyConsumptionPoint[];
  forecast_points: ForecastPoint[];
  metrics: ModelEvaluationMetrics;
  predicted_daily_demand: number;
  avg_daily_historical: number;
  confidence_score: number;
  horizon_days: number;
}

interface MedicineForecastSummary {
  facility_id: string;
  facility_name: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  current_stock: number;
  avg_daily_historical: number;
  predicted_daily_demand: number;
  predicted_7d_demand: number;
  predicted_14d_demand: number;
  predicted_30d_demand: number;
  confidence_score: number;
  model_name: string;
  mape?: number | null;
  days_to_stockout?: number | null;
}

interface GenerateForecastResponse {
  status: string;
  forecasts_generated_count: number;
  average_mape: number;
  average_mae: number;
  message: string;
  timestamp: string;
}

interface FacilityItem {
  id: string;
  name: string;
  facility_type: string;
}

interface MedicineItem {
  id: string;
  name: string;
  category: string;
}

export default function ForecastsPage() {
  const { user } = useAuth();

  const [summaries, setSummaries] = useState<MedicineForecastSummary[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>("");
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [search, setSearch] = useState<string>("");

  // Detail view
  const [detail, setDetail] = useState<FacilityMedicineForecastDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [genNotice, setGenNotice] = useState<string | null>(null);

  const fetchBaselineData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [facData, medData, sumData] = await Promise.all([
        api<FacilityItem[]>("/facilities"),
        api<MedicineItem[]>("/medicines"),
        api<MedicineForecastSummary[]>("/forecasts/summaries"),
      ]);

      setFacilities(facData);
      setMedicines(medData);
      setSummaries(sumData);

      if (facData.length > 0) setSelectedFacilityId(facData[0].id);
      if (medData.length > 0) setSelectedMedicineId(medData[0].id);
    } catch (err: any) {
      setError(err.message || "Failed to load forecasting pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaselineData();
  }, [fetchBaselineData]);

  // Fetch detailed forecast for visualizer
  const fetchDetail = useCallback(async () => {
    if (!selectedFacilityId || !selectedMedicineId) return;
    setDetailLoading(true);
    try {
      const res = await api<FacilityMedicineForecastDetail>(
        `/forecasts/detail?facility_id=${selectedFacilityId}&medicine_id=${selectedMedicineId}&horizon_days=${horizonDays}`
      );
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedFacilityId, selectedMedicineId, horizonDays]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenNotice(null);
    try {
      const res = await api<GenerateForecastResponse>("/forecasts/generate", {
        method: "POST",
        body: JSON.stringify({ horizon_days: horizonDays, model_type: "auto" }),
      });
      setGenNotice(`Retrained models across ${res.forecasts_generated_count} horizons.`);
      await fetchBaselineData();
      await fetchDetail();
    } catch (err: any) {
      setError(err.message || "Failed to trigger forecast generation.");
    } finally {
      setGenerating(false);
    }
  };

  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      const matchesFac = !selectedFacilityId || s.facility_id === selectedFacilityId;
      const matchesMed = !selectedMedicineId || s.medicine_id === selectedMedicineId;
      const matchesSearch =
        !search ||
        s.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
        s.facility_name.toLowerCase().includes(search.toLowerCase());
      return matchesFac && matchesMed && matchesSearch;
    });
  }, [summaries, selectedFacilityId, selectedMedicineId, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demand Forecasting Engine"
        subtitle="Predictive time-series forecasting utilizing Gradient Boosting Regressors with Exponential Moving Average fallback."
        breadcrumbs={[{ label: "Demand Forecasts" }]}
        badgeText="Predictive Intelligence"
        primaryAction={
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Cpu className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Retraining Models..." : "Retrain ML Models"}
          </button>
        }
      />

      {genNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>{genNotice}</span>
          </div>
          <button onClick={() => setGenNotice(null)} className="text-emerald-600 font-bold">Dismiss</button>
        </div>
      )}

      {/* Visualizer & Selection Controls */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Facility Node
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.facility_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Medicine / Drug
              </label>
              <select
                value={selectedMedicineId}
                onChange={(e) => setSelectedMedicineId(e.target.value)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-xs"
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Horizon:</span>
            {[7, 14, 30].map((h) => (
              <button
                key={h}
                onClick={() => setHorizonDays(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  horizonDays === h
                    ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {h} Days
              </button>
            ))}
          </div>
        </div>

        {/* Model Evaluation & Confidence Status Card */}
        {detailLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : detail ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Regressor Model</span>
              <p className="font-bold text-slate-900 text-sm">{detail.metrics.model_name}</p>
              <p className="text-[11px] text-slate-500">Trained on {detail.metrics.sample_count} daily time steps</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confidence Score</span>
              <p className="font-bold text-teal-700 text-sm">{Math.round(detail.confidence_score * 100)}% Confidence</p>
              <p className="text-[11px] text-slate-500">Derived from error metrics & variance</p>
            </div>

            {/* Model Evaluation Metric Integrity Guard */}
            {detail.metrics.evaluation_available === false || detail.metrics.mape == null ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Limited Historical Data
                </div>
                <p className="text-xs text-amber-800 leading-snug">
                  Insufficient historical data for reliable model evaluation.
                </p>
                <p className="text-[11px] text-amber-700">Using Exponential Moving Average. No metrics fabricated.</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Model Error (MAPE / R²)</span>
                <p className="font-bold text-slate-900 text-sm">
                  MAPE: {detail.metrics.mape}% {detail.metrics.r2_score != null ? `| R²: ${detail.metrics.r2_score.toFixed(2)}` : ""}
                </p>
                <p className="text-[11px] text-slate-500">MAE: {detail.metrics.mae?.toFixed(1) ?? "N/A"} units</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Forecast Summaries Table */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Network Forecast Summaries</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine or facility..."
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : error ? (
          <ErrorState description={error} onRetry={fetchBaselineData} />
        ) : filteredSummaries.length === 0 ? (
          <EmptyState
            title="No forecast summaries found"
            description="No medicine forecast summaries match your current search filters."
            icon={TrendingUp}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Pred. Daily Demand</th>
                  <th className="py-3 px-4">14-Day Demand</th>
                  <th className="py-3 px-4">Days to Stockout</th>
                  <th className="py-3 px-4">Model & Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSummaries.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{s.medicine_name}</td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">{s.facility_name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.current_stock.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-teal-700">{s.predicted_daily_demand.toFixed(1)} units</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{s.predicted_14d_demand.toFixed(0)} units</td>
                    <td className="py-3 px-4 font-bold">
                      {s.days_to_stockout != null ? (
                        <span className={s.days_to_stockout <= 7 ? "text-rose-700" : s.days_to_stockout <= 14 ? "text-amber-700" : "text-emerald-700"}>
                          {s.days_to_stockout.toFixed(1)} days
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">{s.model_name}</span>
                        <StatusBadge status={s.confidence_score >= 0.75 ? "HEALTHY" : "AT_RISK"} label={`${Math.round(s.confidence_score * 100)}%`} size="sm" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
