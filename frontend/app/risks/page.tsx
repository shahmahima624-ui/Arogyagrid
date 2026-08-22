"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Sliders,
  TrendingDown,
  Building2,
  Boxes,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

type RiskTier = "CRITICAL" | "HIGH_RISK" | "AT_RISK" | "HEALTHY";

interface StockoutRiskItem {
  facility_id: string;
  facility_name: string;
  facility_type: string;
  district_name: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  current_usable_stock: number;
  predicted_daily_demand: number;
  days_to_stockout: number;
  stockout_time_label: string;
  projected_stockout_date?: string;
  risk_level: RiskTier;
  safety_stock_required: number;
  lead_time_days: number;
  confidence_score: number;
  recommended_action: string;
}

interface RiskSummaryKPIs {
  critical_count: number;
  high_risk_count: number;
  at_risk_count: number;
  healthy_count: number;
  most_vulnerable_facility?: string;
  most_vulnerable_medicine?: string;
  total_monitored_pairs: number;
}

interface RiskAssessmentResponse {
  kpis: RiskSummaryKPIs;
  risks: StockoutRiskItem[];
  as_of: string;
}

export default function RisksPage() {
  const { user } = useAuth();
  const [data, setData] = useState<RiskAssessmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Filters
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Configurable Risk Thresholds
  const [criticalThreshold, setCriticalThreshold] = useState<number>(3.0);
  const [highRiskThreshold, setHighRiskThreshold] = useState<number>(7.0);
  const [atRiskThreshold, setAtRiskThreshold] = useState<number>(14.0);
  const [showConfig, setShowConfig] = useState(false);

  const fetchRisks = useCallback(async () => {
    try {
      setRefreshing(true);
      const queryParams = new URLSearchParams({
        critical_threshold: criticalThreshold.toString(),
        high_risk_threshold: highRiskThreshold.toString(),
        at_risk_threshold: atRiskThreshold.toString(),
      });

      const res = await api<RiskAssessmentResponse>(`/risks?${queryParams.toString()}`);
      setData(res);
    } catch (err) {
      console.error("Failed to load risk engine data", err);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [criticalThreshold, highRiskThreshold, atRiskThreshold]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await api("/risks/recalculate", {
        method: "POST",
        body: JSON.stringify({
          critical_threshold_days: criticalThreshold,
          high_risk_threshold_days: highRiskThreshold,
          at_risk_threshold_days: atRiskThreshold,
        }),
      });
      await fetchRisks();
    } catch (err) {
      console.error("Recalculation error", err);
    } fontFinally: {
      setRecalculating(false);
    }
  };

  const categories = Array.from(new Set(data?.risks.map((r) => r.category) || [])).sort();

  const filteredRisks = data?.risks.filter((r) => {
    const matchesTier = selectedTier === "ALL" || r.risk_level === selectedTier;
    const matchesCategory = categoryFilter === "ALL" || r.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSearch =
      r.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.facility_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesCategory && matchesSearch;
  }) || [];

  const getRiskBadge = (level: RiskTier, timeLabel: string) => {
    switch (level) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-950/80 text-rose-300 border border-rose-600 animate-pulse">
            🚨 CRITICAL ({timeLabel})
          </span>
        );
      case "HIGH_RISK":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600">
            ⚠️ HIGH RISK ({timeLabel})
          </span>
        );
      case "AT_RISK":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-600">
            ⏳ AT RISK ({timeLabel})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700">
            ✓ HEALTHY ({timeLabel})
          </span>
        );
    }
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white text-slate-900 pb-16">
        {/* Top Title Banner */}
        <div className="border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
                  Phase 6 — Actionable Stock-Out Intelligence
                </p>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-500">
                  {user?.role === "DISTRICT_ADMIN" ? "District Health Scope" : "Facility Scoped View"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <ShieldAlert className="h-7 w-7 text-rose-400" />
                Stock-Out Risk Engine
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                  showConfig
                    ? "bg-emerald-950 text-emerald-300 border-emerald-600"
                    : "bg-slate-100 hover:bg-slate-700 border-slate-200 text-slate-700"
                }`}
              >
                <Sliders className="h-4 w-4 text-emerald-400" />
                Threshold Config
              </button>

              <button
                onClick={handleRecalculate}
                disabled={recalculating || refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-900 px-4 py-2 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${recalculating || refreshing ? "animate-spin" : ""}`} />
                {recalculating ? "Recalculating..." : "Recalculate Risks"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* Configurable Threshold Drawer */}
          {showConfig && (
            <div className="mb-8 rounded-2xl border border-emerald-800/80 bg-emerald-950/40 p-6 backdrop-blur space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-400" />
                  Configure Risk Evaluation Cutoffs (Days to Stock-Out)
                </h3>
                <span className="text-xs text-slate-500">Updates dynamic cutoff parameters in real time</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-rose-300 mb-1">
                    Critical Risk Threshold (&lt; {criticalThreshold} days)
                  </label>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.5"
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(parseFloat(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>1.0 day</span>
                    <span className="font-bold text-rose-400">{criticalThreshold} days</span>
                    <span>5.0 days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    High Risk Threshold (3 to {highRiskThreshold} days)
                  </label>
                  <input
                    type="range"
                    min="3.0"
                    max="10.0"
                    step="1.0"
                    value={highRiskThreshold}
                    onChange={(e) => setHighRiskThreshold(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>3.0 days</span>
                    <span className="font-bold text-amber-400">{highRiskThreshold} days</span>
                    <span>10.0 days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-300 mb-1">
                    At Risk Threshold (7 to {atRiskThreshold} days)
                  </label>
                  <input
                    type="range"
                    min="7.0"
                    max="21.0"
                    step="1.0"
                    value={atRiskThreshold}
                    onChange={(e) => setAtRiskThreshold(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>7.0 days</span>
                    <span className="font-bold text-blue-400">{atRiskThreshold} days</span>
                    <span>21.0 days</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="rounded-2xl border border-rose-900/80 bg-rose-950/30 p-4 shadow-sm backdrop-blur ring-1 ring-rose-500/20">
              <div className="flex items-center justify-between text-rose-300">
                <span className="text-xs font-bold uppercase tracking-wider">Critical (&lt;{criticalThreshold}d)</span>
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-rose-400">
                {loading ? "..." : (data?.kpis.critical_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-rose-300/80">Immediate transfer needed</p>
            </div>

            <div className="rounded-2xl border border-amber-900/80 bg-amber-950/30 p-4 shadow-sm backdrop-blur ring-1 ring-amber-500/20">
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-xs font-bold uppercase tracking-wider">High Risk ({criticalThreshold}-{highRiskThreshold}d)</span>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-amber-400">
                {loading ? "..." : (data?.kpis.high_risk_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-amber-300/80">Reorder within 48h</p>
            </div>

            <div className="rounded-2xl border border-blue-900/80 bg-blue-950/30 p-4 shadow-sm backdrop-blur ring-1 ring-blue-500/20">
              <div className="flex items-center justify-between text-blue-300">
                <span className="text-xs font-bold uppercase tracking-wider">At Risk ({highRiskThreshold}-{atRiskThreshold}d)</span>
                <Clock className="h-4 w-4 text-blue-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-blue-400">
                {loading ? "..." : (data?.kpis.at_risk_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-blue-300/80">Monitor dispensing velocity</p>
            </div>

            <div className="rounded-2xl border border-emerald-900/80 bg-emerald-950/30 p-4 shadow-sm backdrop-blur ring-1 ring-emerald-500/20">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-xs font-bold uppercase tracking-wider">Healthy (&gt;{atRiskThreshold}d)</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-emerald-400">
                {loading ? "..." : (data?.kpis.healthy_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-300/80">Buffer adequate</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm backdrop-blur col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Top Vulnerability</span>
                <Building2 className="h-4 w-4 text-purple-400" />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 truncate">
                {loading ? "..." : (data?.kpis.most_vulnerable_facility || "None")}
              </p>
              <p className="mt-1 text-[11px] text-purple-300 truncate">
                Med: {data?.kpis.most_vulnerable_medicine || "N/A"}
              </p>
            </div>
          </section>

          {/* Search and Filters Bar */}
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facility or medicine name..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-200 text-xs">
                {(["ALL", "CRITICAL", "HIGH_RISK", "AT_RISK", "HEALTHY"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      selectedTier === tier
                        ? tier === "CRITICAL"
                          ? "bg-rose-600 text-slate-900"
                          : tier === "HIGH_RISK"
                          ? "bg-amber-600 text-slate-900"
                          : tier === "AT_RISK"
                          ? "bg-blue-600 text-slate-900"
                          : tier === "HEALTHY"
                          ? "bg-emerald-600 text-slate-900"
                          : "bg-slate-700 text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tier === "ALL" ? "All Tiers" : tier.replace("_", " ")}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Risk Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 backdrop-blur shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                  <th className="px-6 py-4">Medicine & Category</th>
                  <th className="px-6 py-4">Facility & Type</th>
                  <th className="px-6 py-4">Usable Stock</th>
                  <th className="px-6 py-4">Pred. Demand</th>
                  <th className="px-6 py-4">Days to Stockout</th>
                  <th className="px-6 py-4">Risk Tier</th>
                  <th className="px-6 py-4">Action & Safety</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredRisks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No stock-out risk nodes match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRisks.map((item, idx) => (
                    <tr
                      key={`${item.facility_id}-${item.medicine_id}-${idx}`}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.risk_level === "CRITICAL" ? "bg-rose-950/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{item.medicine_name}</div>
                        <span className="text-xs text-slate-500">{item.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                          {item.facility_name}
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {item.facility_type} • {item.district_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">
                        <span className={`font-bold ${item.current_usable_stock === 0 ? "text-rose-400 font-black" : "text-slate-700"}`}>
                          {item.current_usable_stock.toLocaleString()} units
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">
                        {item.predicted_daily_demand} / day
                        <div className="text-[10px] text-slate-500">Conf: {Math.round(item.confidence_score * 100)}%</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-extrabold text-slate-900 text-base">
                          {item.days_to_stockout >= 90 ? ">90 days" : `${item.days_to_stockout} days`}
                        </div>
                        <span className="text-xs text-slate-500">{item.stockout_time_label}</span>
                      </td>
                      <td className="px-6 py-4">
                        {getRiskBadge(item.risk_level, item.stockout_time_label)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {item.recommended_action}
                        </p>
                        <div className="text-[11px] text-slate-500 mt-1 font-mono">
                          Safety Req: {item.safety_stock_required} units (LT: {item.lead_time_days}d)
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
