"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
 Activity,
 AlertTriangle,
 ArrowRight,
 Boxes,
 Building2,
 Calendar,
 CheckCircle2,
 ChevronRight,
 Clock,
 Cpu,
 Download,
 Filter,
 Layers,
 LineChart,
 RefreshCw,
 Search,
 ShieldCheck,
 Sparkles,
 TrendingDown,
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
 mae: number;
 rmse: number;
 mape: number;
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
 mape: number;
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
 const [isGenerating, setIsGenerating] = useState(false);
 const [generationNotice, setGenerationNotice] = useState<string | null>(null);

 // Selected item for interactive visualizer
 const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
 const [selectedMedicineId, setSelectedMedicineId] = useState<string>("");
 const [horizonDays, setHorizonDays] = useState<number>(14);
 const [detail, setDetail] = useState<FacilityMedicineForecastDetail | null>(null);
 const [detailLoading, setDetailLoading] = useState(false);

 // Filters for table
 const [searchQuery, setSearchQuery] = useState("");
 const [categoryFilter, setCategoryFilter] = useState("ALL");
 const [stockoutRiskOnly, setStockoutRiskOnly] = useState(false);

 const loadInitData = useCallback(async () => {
 try {
 setLoading(true);
 const [facList, medList, summaryList] = await Promise.all([
 api<FacilityItem[]>("/facilities"),
 api<MedicineItem[]>("/medicines"),
 api<MedicineForecastSummary[]>("/forecasts"),
 ]);

 setFacilities(facList);
 setMedicines(medList);
 setSummaries(summaryList);

 if (facList.length > 0 && medList.length > 0) {
 // Pre-select facility based on role or first in list
 const initialFacId = user?.facility_id || facList[0].id;
 const initialMedId = medList[0].id;
 setSelectedFacilityId(initialFacId);
 setSelectedMedicineId(initialMedId);
 }
 } catch {
 // Fallback
 } finally {
 setLoading(false);
 }
 }, [user]);

 useEffect(() => {
 loadInitData();
 }, [loadInitData]);

 // Load detail when selection changes
 const loadDetail = useCallback(async () => {
 if (!selectedFacilityId || !selectedMedicineId) return;
 try {
 setDetailLoading(true);
 const res = await api<FacilityMedicineForecastDetail>(
 `/forecasts/${selectedFacilityId}/${selectedMedicineId}?horizon_days=${horizonDays}`
 );
 setDetail(res);
 } catch {
 setDetail(null);
 } finally {
 setDetailLoading(false);
 }
 }, [selectedFacilityId, selectedMedicineId, horizonDays]);

 useEffect(() => {
 loadDetail();
 }, [loadDetail]);

 const handleRetrain = async () => {
 try {
 setIsGenerating(true);
 setGenerationNotice(null);
 const res = await api<GenerateForecastResponse>("/forecasts/generate", {
 method: "POST",
 body: JSON.stringify({ horizon_days: horizonDays }),
 });

 setGenerationNotice(
 `✓ ${res.message} (Average model error: ${res.average_mape}% MAPE / ${res.average_mae} units MAE)`
 );

 // Refresh data
 const refreshedSummaries = await api<MedicineForecastSummary[]>("/forecasts");
 setSummaries(refreshedSummaries);
 loadDetail();
 } catch (err: unknown) {
 const msg = err instanceof Error ? err.message : "Retraining failed";
 setGenerationNotice(`✕ Retraining error: ${msg}`);
 } finally {
 setIsGenerating(false);
 }
 };

 // Top Hero Metrics Calculation
 const metricsOverview = useMemo(() => {
 if (!summaries.length) {
 return { total14d: 0, topMed: "—", avgMape: 0, modelsCount: 0 };
 }
 const total14d = summaries.reduce((acc, curr) => acc + curr.predicted_14d_demand, 0);

 // Group by medicine to find top demand
 const medTotals: Record<string, number> = {};
 summaries.forEach((s) => {
 medTotals[s.medicine_name] = (medTotals[s.medicine_name] || 0) + s.predicted_14d_demand;
 });
 const sortedMeds = Object.entries(medTotals).sort((a, b) => b[1] - a[1]);
 const topMed = sortedMeds.length > 0 ? sortedMeds[0][0] : "—";

 const avgMape = summaries.reduce((acc, curr) => acc + curr.mape, 0) / summaries.length;

 return {
 total14d: Math.round(total14d),
 topMed,
 avgMape: Math.round(avgMape * 10) / 10,
 modelsCount: summaries.length,
 };
 }, [summaries]);

 // Filtered summaries for table
 const filteredSummaries = useMemo(() => {
 return summaries.filter((s) => {
 const matchSearch =
 s.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 s.facility_name.toLowerCase().includes(searchQuery.toLowerCase());
 const matchCat = categoryFilter === "ALL" || s.category === categoryFilter;
 const matchRisk = !stockoutRiskOnly || (s.days_to_stockout !== null && (s.days_to_stockout ?? 999) < 14);
 return matchSearch && matchCat && matchRisk;
 });
 }, [summaries, searchQuery, categoryFilter, stockoutRiskOnly]);

 const categories = useMemo(() => {
 const set = new Set<string>();
 medicines.forEach((m) => set.add(m.category));
 return Array.from(set).sort();
 }, [medicines]);

 // SVG Chart Calculation
 const chartData = useMemo(() => {
 if (!detail) return null;

 const hist = detail.historical_points;
 const fore = detail.forecast_points;

 const allDates = [...hist.map((h) => h.date), ...fore.map((f) => f.date)];
 const allVals = [
 ...hist.map((h) => h.quantity),
 ...fore.map((f) => f.upper_bound),
 ...fore.map((f) => f.predicted_quantity),
 ];

 const maxVal = Math.max(...allVals, 10) * 1.15;
 const minVal = 0;

 const width = 800;
 const height = 300;
 const padding = { top: 20, right: 30, bottom: 40, left: 50 };

 const plotW = width - padding.left - padding.right;
 const plotH = height - padding.top - padding.bottom;

 const totalPoints = allDates.length;
 const getX = (index: number) => padding.left + (index / Math.max(totalPoints - 1, 1)) * plotW;
 const getY = (val: number) => padding.top + plotH - (val / maxVal) * plotH;

 // Build historical path
 const histPoints = hist.map((h, i) => ({ x: getX(i), y: getY(h.quantity), ...h }));
 const histPath = histPoints.length > 0 ? `M ${histPoints.map((p) => `${p.x},${p.y}`).join(" L ")}` : "";

 // Build rolling 7d path
 const rollPoints = hist
 .map((h, i) => (h.rolling_7d_avg !== null ? { x: getX(i), y: getY(h.rolling_7d_avg!) } : null))
 .filter((p): p is { x: number; y: number } => p !== null);
 const rollPath = rollPoints.length > 0 ? `M ${rollPoints.map((p) => `${p.x},${p.y}`).join(" L ")}` : "";

 // Build forecast path
 const startIdx = hist.length - 1;
 const forePointsWithAnchor = [
 histPoints[startIdx]
 ? {
 x: histPoints[startIdx].x,
 y: histPoints[startIdx].y,
 val: hist[startIdx].quantity,
 date: hist[startIdx].date,
 lower_bound: hist[startIdx].quantity,
 upper_bound: hist[startIdx].quantity,
 }
 : null,
 ...fore.map((f, i) => ({
 x: getX(hist.length + i),
 y: getY(f.predicted_quantity),
 upperY: getY(f.upper_bound),
 lowerY: getY(f.lower_bound),
 val: f.predicted_quantity,
 date: f.date,
 lower_bound: f.lower_bound,
 upper_bound: f.upper_bound,
 })),
 ].filter(Boolean) as Array<{
 x: number;
 y: number;
 upperY?: number;
 lowerY?: number;
 val: number;
 date: string;
 lower_bound: number;
 upper_bound: number;
 }>;

 const forePath =
 forePointsWithAnchor.length > 0
 ? `M ${forePointsWithAnchor.map((p) => `${p.x},${p.y}`).join(" L ")}`
 : "";

 // Build confidence area path
 const upperPoints = fore.map((f, i) => ({ x: getX(hist.length + i), y: getY(f.upper_bound) }));
 const lowerPoints = fore.map((f, i) => ({ x: getX(hist.length + i), y: getY(f.lower_bound) }));
 lowerPoints.reverse();

 const confidenceAreaPath =
 upperPoints.length > 0
 ? `M ${upperPoints.map((p) => `${p.x},${p.y}`).join(" L ")} L ${lowerPoints
 .map((p) => `${p.x},${p.y}`)
 .join(" L ")} Z`
 : "";

 return {
 width,
 height,
 padding,
 plotW,
 plotH,
 maxVal,
 histPoints,
 histPath,
 rollPath,
 forePoints: forePointsWithAnchor,
 forePath,
 confidenceAreaPath,
 splitX: histPoints[startIdx]?.x ?? padding.left,
 allDates,
 };
 }, [detail]);

 return (
 <>
 <Nav />
 <main className="min-h-screen bg-white text-slate-900 pb-20">
 {/* Top Header Banner */}
 <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 lg:px-8 py-6">
 <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <div className="flex items-center gap-2">
 <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
 <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
 Predictive Demand Intelligence Engine
 </p>
 <span className="text-slate-500">•</span>
 <span className="text-xs text-slate-500">
 Model: GradientBoostingRegressor + Autoregressive Horizon
 </span>
 </div>
 <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
 Demand Forecasting & Consumption Trajectory
 </h1>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={handleRetrain}
 disabled={isGenerating}
 className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
 >
 <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
 {isGenerating ? "Training ML Models..." : "Re-train & Generate Forecasts"}
 </button>
 </div>
 </div>
 </div>

 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
 {/* Generation Feedback Notice */}
 {generationNotice && (
 <div
 className={`mb-6 p-4 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
 generationNotice.startsWith("✓")
 ? "bg-white border-slate-200 text-emerald-600"
 : "bg-white border-slate-200 text-rose-600"
 }`}
 >
 <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
 <span>{generationNotice}</span>
 </div>
 )}

 {/* 4 Hero KPI Cards */}
 <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
 <div className="flex items-center justify-between text-cyan-600">
 <span className="text-xs font-semibold uppercase tracking-wider">14-Day District Demand</span>
 <TrendingUp className="h-5 w-5 text-cyan-600" />
 </div>
 <p className="mt-3 text-3xl font-black text-slate-900">
 {loading ? "..." : metricsOverview.total14d.toLocaleString()}
 </p>
 <p className="mt-1 text-xs text-slate-500">Total Projected Consumption Units</p>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
 <div className="flex items-center justify-between text-emerald-600">
 <span className="text-xs font-semibold uppercase tracking-wider">Top Demand Medicine</span>
 <Boxes className="h-5 w-5 text-emerald-600" />
 </div>
 <p className="mt-3 text-xl font-bold text-slate-900 truncate" title={metricsOverview.topMed}>
 {loading ? "..." : metricsOverview.topMed}
 </p>
 <p className="mt-1 text-xs text-slate-500">Highest Volume Consumption</p>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ">
 <div className="flex items-center justify-between text-purple-600">
 <span className="text-xs font-semibold uppercase tracking-wider">Model Accuracy (MAPE)</span>
 <ShieldCheck className="h-5 w-5 text-purple-600" />
 </div>
 <p className="mt-3 text-3xl font-black text-purple-600">
 {loading ? "..." : `${metricsOverview.avgMape}%`}
 </p>
 <p className="mt-1 text-xs text-purple-600">Mean Absolute % Error on Test Split</p>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ">
 <div className="flex items-center justify-between text-amber-600">
 <span className="text-xs font-semibold uppercase tracking-wider">Trained ML Regressors</span>
 <Cpu className="h-5 w-5 text-amber-600" />
 </div>
 <p className="mt-3 text-3xl font-black text-amber-600">
 {loading ? "..." : metricsOverview.modelsCount}
 </p>
 <p className="mt-1 text-xs text-amber-600">Active Time-Series Models</p>
 </div>
 </section>

 {/* INTERACTIVE VISUALIZER SECTION */}
 <section className="rounded-3xl border border-slate-200 bg-white -xl p-6 sm:p-8 shadow-xl mb-10">
 {/* Visualizer Controls */}
 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
 <div className="flex flex-wrap items-center gap-3">
 {/* Facility Selector */}
 <div>
 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
 Facility Node
 </label>
 <select
 value={selectedFacilityId}
 onChange={(e) => setSelectedFacilityId(e.target.value)}
 className="bg-slate-100 border border-slate-200 text-sm font-semibold rounded-xl px-3.5 py-2 text-slate-900 focus:outline-hidden focus:border-cyan-500"
 >
 {facilities.map((fac) => (
 <option key={fac.id} value={fac.id}>
 {fac.name} ({fac.facility_type})
 </option>
 ))}
 </select>
 </div>

 {/* Medicine Selector */}
 <div>
 <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
 Medicine / Drug
 </label>
 <select
 value={selectedMedicineId}
 onChange={(e) => setSelectedMedicineId(e.target.value)}
 className="bg-slate-100 border border-slate-200 text-sm font-semibold rounded-xl px-3.5 py-2 text-slate-900 focus:outline-hidden focus:border-cyan-500 max-w-[240px]"
 >
 {medicines.map((med) => (
 <option key={med.id} value={med.id}>
 {med.name} ({med.category})
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Horizon Selector */}
 <div className="flex items-center gap-2 self-start lg:self-auto">
 <span className="text-xs font-semibold text-slate-500">Forecast Horizon:</span>
 <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
 {[7, 14, 30].map((days) => (
 <button
 key={days}
 onClick={() => setHorizonDays(days)}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
 horizonDays === days
 ? "bg-cyan-500 text-slate-950 shadow-xs"
 : "text-slate-500 hover:text-slate-700"
 }`}
 >
 {days} Days
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Time Series Chart & Performance Stats */}
 <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
 {/* Left 3 cols: Time Series SVG Chart */}
 <div className="lg:col-span-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5">
 <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
 <div>
 <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
 <LineChart className="h-4 w-4 text-cyan-600" />
 Historical Consumption & Predictive Trajectory
 </h3>
 <p className="text-xs text-slate-500 mt-0.5">
 Empirical daily dispensing + {horizonDays}-day ML predicted demand with 95% confidence interval
 </p>
 </div>

 {/* Legend */}
 <div className="flex flex-wrap items-center gap-4 text-xs">
 <div className="flex items-center gap-1.5">
 <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
 <span className="text-slate-600">Historical Actuals</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-2 w-4 bg-blue-400 rounded-sm" />
 <span className="text-slate-600">7d Rolling Avg</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-2 w-4 border-b-2 border-dashed border-cyan-400" />
 <span className="text-cyan-600 font-medium">ML Forecast</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-2.5 w-3 bg-cyan-400/20 border border-cyan-400/40 rounded-xs" />
 <span className="text-slate-500">95% CI</span>
 </div>
 </div>
 </div>

 {/* SVG Visualizer */}
 {detailLoading ? (
 <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
 <RefreshCw className="h-5 w-5 animate-spin mr-2 text-cyan-600" /> Computing model forecast...
 </div>
 ) : chartData ? (
 <div className="relative w-full overflow-x-auto">
 <svg
 viewBox={`0 0 ${chartData.width} ${chartData.height}`}
 className="w-full h-auto min-w-[640px]"
 >
 {/* Grid Lines */}
 {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
 const y = chartData.padding.top + chartData.plotH * pct;
 const val = Math.round(chartData.maxVal * (1 - pct));
 return (
 <g key={pct}>
 <line
 x1={chartData.padding.left}
 y1={y}
 x2={chartData.width - chartData.padding.right}
 y2={y}
 stroke="#334155"
 strokeDasharray="4 4"
 strokeWidth="0.75"
 />
 <text
 x={chartData.padding.left - 8}
 y={y + 4}
 fill="#64748b"
 fontSize="10"
 textAnchor="end"
 fontFamily="monospace"
 >
 {val}
 </text>
 </g>
 );
 })}

 {/* Forecast Zone Background Shading */}
 <rect
 x={chartData.splitX}
 y={chartData.padding.top}
 width={chartData.width - chartData.padding.right - chartData.splitX}
 height={chartData.plotH}
 fill="#06b6d4"
 fillOpacity="0.04"
 />

 {/* Split Line (Today) */}
 <line
 x1={chartData.splitX}
 y1={chartData.padding.top}
 x2={chartData.splitX}
 y2={chartData.height - chartData.padding.bottom}
 stroke="#06b6d4"
 strokeWidth="1.5"
 strokeDasharray="3 3"
 />
 <text
 x={chartData.splitX}
 y={chartData.padding.top - 6}
 fill="#06b6d4"
 fontSize="10"
 fontWeight="bold"
 textAnchor="middle"
 >
 TODAY (T=0)
 </text>

 {/* Confidence Band Area */}
 {chartData.confidenceAreaPath && (
 <path
 d={chartData.confidenceAreaPath}
 fill="#06b6d4"
 fillOpacity="0.12"
 />
 )}

 {/* Historical Consumption Line */}
 {chartData.histPath && (
 <path
 d={chartData.histPath}
 fill="none"
 stroke="#10b981"
 strokeWidth="2"
 />
 )}

 {/* 7d Rolling Average Line */}
 {chartData.rollPath && (
 <path
 d={chartData.rollPath}
 fill="none"
 stroke="#38bdf8"
 strokeWidth="1.5"
 strokeOpacity="0.8"
 />
 )}

 {/* Forecast Trajectory Line */}
 {chartData.forePath && (
 <path
 d={chartData.forePath}
 fill="none"
 stroke="#22d3ee"
 strokeWidth="2.5"
 strokeDasharray="5 4"
 />
 )}

 {/* Data Points */}
 {chartData.histPoints.map((pt, idx) => (
 <circle
 key={`hist-${idx}`}
 cx={pt.x}
 cy={pt.y}
 r="2.5"
 fill="#10b981"
 className="hover:r-4 transition-all"
 >
 <title>{`${pt.date}: ${pt.quantity} units (Patients: ${pt.patient_count ?? "N/A"})`}</title>
 </circle>
 ))}

 {chartData.forePoints.map((pt, idx) => (
 <circle
 key={`fore-${idx}`}
 cx={pt.x}
 cy={pt.y}
 r="3"
 fill="#22d3ee"
 stroke="#083344"
 strokeWidth="1"
 >
 <title>{`${pt.date}: Predicted ${pt.val} units (95% CI: ${pt.lowerY ? pt.lower_bound : ""}-${pt.upperY ? pt.upper_bound : ""})`}</title>
 </circle>
 ))}

 {/* X-axis date labels */}
 {chartData.histPoints.length > 0 && (
 <text
 x={chartData.histPoints[0].x}
 y={chartData.height - chartData.padding.bottom + 18}
 fill="#64748b"
 fontSize="10"
 >
 {chartData.histPoints[0].date}
 </text>
 )}
 <text
 x={chartData.splitX}
 y={chartData.height - chartData.padding.bottom + 18}
 fill="#06b6d4"
 fontSize="10"
 textAnchor="middle"
 fontWeight="bold"
 >
 Current Date
 </text>
 {chartData.forePoints.length > 0 && (
 <text
 x={chartData.width - chartData.padding.right}
 y={chartData.height - chartData.padding.bottom + 18}
 fill="#64748b"
 fontSize="10"
 textAnchor="end"
 >
 +{horizonDays} Days
 </text>
 )}
 </svg>
 </div>
 ) : (
 <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
 No consumption data available for this facility/medicine pair.
 </div>
 )}
 </div>

 {/* Right 1 col: Live Model Evaluation Card */}
 <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 space-y-4">
 <div>
 <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-600 px-2 py-0.5 rounded-full bg-white border border-slate-200">
 Live Model Evaluation
 </span>
 <h4 className="text-base font-extrabold text-slate-900 mt-2">
 {detail?.metrics.model_name ?? "GradientBoostingRegressor"}
 </h4>
 <p className="text-xs text-slate-500">
 Trained on {detail?.metrics.sample_count ?? 0} historical daily time steps
 </p>
 </div>

 <div className="space-y-2.5 pt-2 border-t border-slate-200">
 <div className="flex items-center justify-between text-xs">
 <span className="text-slate-500">Mean Absolute Error (MAE):</span>
 <span className="font-mono font-bold text-slate-900">
 {detail?.metrics.mae ?? "—"} units/day
 </span>
 </div>

 <div className="flex items-center justify-between text-xs">
 <span className="text-slate-500">Root Mean Sq Error (RMSE):</span>
 <span className="font-mono font-bold text-slate-900">
 {detail?.metrics.rmse ?? "—"}
 </span>
 </div>

 <div className="flex items-center justify-between text-xs">
 <span className="text-slate-500">Test Split Error (MAPE):</span>
 <span className="font-mono font-bold text-purple-600">
 {detail?.metrics.mape ?? "—"}%
 </span>
 </div>

 <div className="flex items-center justify-between text-xs">
 <span className="text-slate-500">Predicted Daily Demand:</span>
 <span className="font-mono font-bold text-emerald-600">
 {detail?.predicted_daily_demand ?? "—"} units
 </span>
 </div>

 <div className="flex items-center justify-between text-xs">
 <span className="text-slate-500">Confidence Rating:</span>
 <span className="font-bold text-cyan-600">
 {detail ? `${Math.round(detail.confidence_score * 100)}%` : "—"}
 </span>
 </div>
 </div>

 {/* Stockout status callout */}
 <div className="pt-3 border-t border-slate-200">
 <div className="p-3 rounded-xl bg-white border border-slate-200">
 <div className="text-[11px] text-slate-500">Current Facility Stock:</div>
 <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
 {detail?.current_stock.toLocaleString() ?? 0} units
 </div>
 <div className="text-xs text-slate-500 mt-1">
 Estimated runway:{" "}
 <strong className="text-cyan-600">
 {detail && detail.predicted_daily_demand > 0
 ? `${Math.round(detail.current_stock / detail.predicted_daily_demand)} days`
 : "Adequate"}
 </strong>
 </div>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* DEMAND FORECAST SUMMARY MATRIX TABLE */}
 <section className="space-y-4">
 <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search medicine or facility name..."
 className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
 />
 </div>

 <div className="flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2">
 <Filter className="h-4 w-4 text-slate-500" />
 <select
 value={categoryFilter}
 onChange={(e) => setCategoryFilter(e.target.value)}
 className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:border-cyan-500"
 >
 <option value="ALL">All Categories</option>
 {categories.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 </div>

 <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-xl">
 <input
 type="checkbox"
 checked={stockoutRiskOnly}
 onChange={(e) => setStockoutRiskOnly(e.target.checked)}
 className="rounded-sm bg-slate-100 border-slate-200 text-cyan-500 focus:ring-0"
 />
 <span>Stockout Risk &lt; 14d</span>
 </label>
 </div>
 </div>

 {/* Table */}
 <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
 <th className="px-6 py-4">Facility & Medicine</th>
 <th className="px-6 py-4">Category</th>
 <th className="px-6 py-4">Current Stock</th>
 <th className="px-6 py-4">Predicted Daily</th>
 <th className="px-6 py-4">7d Projected</th>
 <th className="px-6 py-4">14d Projected</th>
 <th className="px-6 py-4">Days to Stockout</th>
 <th className="px-6 py-4">Confidence</th>
 <th className="px-6 py-4 text-right">Inspect</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800/60 text-sm">
 {filteredSummaries.length === 0 ? (
 <tr>
 <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
 No forecast records match the active filter criteria.
 </td>
 </tr>
 ) : (
 filteredSummaries.map((item, idx) => {
 const isStockoutRisk =
 item.days_to_stockout !== null && (item.days_to_stockout ?? 999) < 7;
 const isWarning =
 item.days_to_stockout !== null &&
 (item.days_to_stockout ?? 999) >= 7 &&
 (item.days_to_stockout ?? 999) < 14;

 return (
 <tr
 key={`${item.facility_id}-${item.medicine_id}-${idx}`}
 className="hover:bg-slate-50 transition-colors"
 >
 <td className="px-6 py-4">
 <div className="font-semibold text-slate-900">{item.medicine_name}</div>
 <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
 <Building2 className="h-3 w-3 text-emerald-600" />
 {item.facility_name}
 </span>
 </td>
 <td className="px-6 py-4 text-slate-600">{item.category}</td>
 <td className="px-6 py-4 font-mono font-semibold text-slate-700">
 {item.current_stock.toLocaleString()} units
 </td>
 <td className="px-6 py-4 font-mono text-cyan-600 font-bold">
 {item.predicted_daily_demand} /day
 </td>
 <td className="px-6 py-4 font-mono text-slate-600">
 {item.predicted_7d_demand}
 </td>
 <td className="px-6 py-4 font-mono text-slate-600">
 {item.predicted_14d_demand}
 </td>
 <td className="px-6 py-4">
 {item.days_to_stockout !== null ? (
 <span
 className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
 isStockoutRisk
 ? "bg-white text-rose-600 border border-rose-700"
 : isWarning
 ? "bg-white text-amber-600 border border-amber-700"
 : "bg-white text-emerald-600 border border-emerald-700"
 }`}
 >
 {isStockoutRisk ? "🚨 " : isWarning ? "⚠️ " : "✓ "}
 {item.days_to_stockout} days
 </span>
 ) : (
 <span className="text-xs text-slate-500">N/A</span>
 )}
 </td>
 <td className="px-6 py-4">
 <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-cyan-600">
 {Math.round(item.confidence_score * 100)}%
 </span>
 </td>
 <td className="px-6 py-4 text-right">
 <button
 onClick={() => {
 setSelectedFacilityId(item.facility_id);
 setSelectedMedicineId(item.medicine_id);
 window.scrollTo({ top: 400, behavior: "smooth" });
 }}
 className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:text-cyan-600 hover:underline"
 >
 Chart <ArrowRight className="h-3 w-3" />
 </button>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </section>
 </div>
 </main>
 </>
 );
}
