"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Clock,
  RefreshCw,
  Search,
  Filter,
  Building2,
  Boxes,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

type UrgencyTier = "CRITICAL_30" | "WARNING_60" | "ATTENTION_90" | "NORMAL";
type RescuePriority = "HIGH" | "MEDIUM" | "LOW";

interface BatchExpiryRisk {
  batch_id: string;
  batch_number: string;
  facility_id?: string;
  facility_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  quantity: number;
  expiry_date: string;
  days_until_expiry: number;
  expected_daily_consumption: number;
  expected_consumption_before_expiry: number;
  potential_expiring_surplus: number;
  urgency: UrgencyTier;
  is_rescue_candidate: boolean;
  recommended_action: string;
}

interface ExpiryRescueOpportunity {
  batch_id: string;
  batch_number: string;
  source_facility_id?: string;
  source_facility_name?: string;
  source_warehouse_id?: string;
  source_warehouse_name?: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  batch_quantity: number;
  expiry_date: string;
  days_until_expiry: number;
  expected_local_consumption: number;
  rescueable_surplus: number;
  priority: RescuePriority;
  reason: string;
}

interface ExpiryEngineKPIs {
  total_batches_monitored: number;
  expiring_soon_count: number;
  total_expiring_units: number;
  total_rescueable_surplus_units: number;
  most_vulnerable_facility?: string;
  most_vulnerable_medicine?: string;
}

interface ExpiryAssessmentResponse {
  kpis: ExpiryEngineKPIs;
  batch_risks: BatchExpiryRisk[];
  rescue_opportunities: ExpiryRescueOpportunity[];
  as_of: string;
}

export default function ExpiryRescuePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ExpiryAssessmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"opportunities" | "all_batches">("opportunities");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const fetchExpiryData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api<ExpiryAssessmentResponse>("/expiry/risks");
      setData(res);
    } catch (err) {
      console.error("Failed to fetch expiry engine data", err);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExpiryData();
  }, [fetchExpiryData]);

  const categories = Array.from(new Set(data?.batch_risks.map((b) => b.category) || [])).sort();

  const filteredOpportunities = data?.rescue_opportunities.filter((opp) => {
    const matchesPriority = priorityFilter === "ALL" || opp.priority === priorityFilter;
    const matchesCategory = categoryFilter === "ALL" || opp.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSearch =
      opp.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.source_facility_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.batch_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPriority && matchesCategory && matchesSearch;
  }) || [];

  const filteredBatches = data?.batch_risks.filter((b) => {
    const matchesUrgency = urgencyFilter === "ALL" || b.urgency === urgencyFilter;
    const matchesCategory = categoryFilter === "ALL" || b.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSearch =
      b.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.facility_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batch_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUrgency && matchesCategory && matchesSearch;
  }) || [];

  const getUrgencyBadge = (urgency: UrgencyTier, days: number) => {
    switch (urgency) {
      case "CRITICAL_30":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-rose-950/80 text-rose-300 border border-rose-600 animate-pulse">
            ⚡ {days}d to expiry (≤30d)
          </span>
        );
      case "WARNING_60":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600">
            ⏳ {days}d to expiry (31-60d)
          </span>
        );
      case "ATTENTION_90":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-600">
            🕒 {days}d to expiry (61-90d)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            ✓ {days}d to expiry
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: RescuePriority) => {
    switch (priority) {
      case "HIGH":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-950/80 text-purple-300 border border-purple-600">🔥 HIGH PRIORITY RESCUE</span>;
      case "MEDIUM":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600">⚡ MEDIUM PRIORITY</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-600">ℹ️ ROUTINE RESCUE</span>;
    }
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-slate-900 text-slate-100 pb-16">
        {/* Title Banner */}
        <div className="border-b border-slate-800 bg-slate-950/60 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Phase 7 — Wastage Prevention & FEFO Optimization
                </p>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">
                  {user?.role === "DISTRICT_ADMIN" ? "District Central Scope" : "Facility Scoped View"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Clock className="h-7 w-7 text-amber-400" />
                Expiry Rescue Engine
              </h1>
            </div>

            <button
              onClick={fetchExpiryData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors self-start md:self-auto shadow-xs"
            >
              <RefreshCw className={`h-4 w-4 text-amber-400 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Scanning..." : "Rescan Batch Expiries"}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* Top Hero KPI Cards */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Total Batches</span>
                <Boxes className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-white">
                {loading ? "..." : (data?.kpis.total_batches_monitored ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Monitored in Grid</p>
            </div>

            <div className="rounded-2xl border border-amber-900/80 bg-amber-950/30 p-4 shadow-sm backdrop-blur ring-1 ring-amber-500/20">
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-xs font-bold uppercase tracking-wider">Expiring &le; 90d</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-amber-400">
                {loading ? "..." : (data?.kpis.expiring_soon_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-amber-300/80">
                {data?.kpis.total_expiring_units.toLocaleString() ?? 0} total units
              </p>
            </div>

            <div className="rounded-2xl border border-purple-900/80 bg-purple-950/30 p-4 shadow-sm backdrop-blur ring-1 ring-purple-500/20">
              <div className="flex items-center justify-between text-purple-300">
                <span className="text-xs font-bold uppercase tracking-wider">Rescueable Surplus</span>
                <Sparkles className="h-4 w-4 text-purple-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-purple-400">
                {loading ? "..." : (data?.kpis.total_rescueable_surplus_units.toLocaleString() ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-purple-300/80">Units ready to redistribute</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Top Surplus Node</span>
                <Building2 className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="mt-2 text-base font-bold text-white truncate">
                {loading ? "..." : (data?.kpis.most_vulnerable_facility || "None")}
              </p>
              <p className="mt-1 text-[11px] text-cyan-300 truncate">
                Excess: {data?.kpis.most_vulnerable_medicine || "N/A"}
              </p>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 mb-6 pb-2">
            <button
              onClick={() => setActiveTab("opportunities")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "opportunities"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              <Sparkles className={`h-4 w-4 ${activeTab === "opportunities" ? "text-purple-400" : "text-slate-500"}`} />
              <span>Expiry Rescue Candidates</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "opportunities" ? "bg-purple-500/30 text-purple-200" : "bg-slate-800 text-slate-400"}`}>
                {data?.rescue_opportunities.length ?? 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all_batches")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "all_batches"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              <Clock className={`h-4 w-4 ${activeTab === "all_batches" ? "text-amber-400" : "text-slate-500"}`} />
              <span>All Batch Expiry Audit</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "all_batches" ? "bg-amber-500/30 text-amber-200" : "bg-slate-800 text-slate-400"}`}>
                {data?.batch_risks.length ?? 0}
              </span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facility, medicine, or batch..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "opportunities" ? (
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
                  {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((prio) => (
                    <button
                      key={prio}
                      onClick={() => setPriorityFilter(prio)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        priorityFilter === prio
                          ? "bg-purple-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {prio === "ALL" ? "All Priorities" : `${prio} Priority`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
                  {(["ALL", "CRITICAL_30", "WARNING_60", "ATTENTION_90"] as const).map((urg) => (
                    <button
                      key={urg}
                      onClick={() => setUrgencyFilter(urg)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        urgencyFilter === urg
                          ? "bg-amber-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {urg === "ALL" ? "All Expiries" : urg === "CRITICAL_30" ? "≤ 30d" : urg === "WARNING_60" ? "31-60d" : "61-90d"}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500"
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

          {/* TAB 1: Expiry Rescue Opportunities */}
          {activeTab === "opportunities" && (
            <div className="space-y-4">
              {filteredOpportunities.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-12 text-center text-slate-500">
                  No active rescue candidates match the filter criteria.
                </div>
              ) : (
                filteredOpportunities.map((opp) => (
                  <div
                    key={opp.batch_id}
                    className="p-5 rounded-2xl border border-purple-900/60 bg-slate-800/60 backdrop-blur hover:border-purple-600/80 transition-all shadow-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg font-bold text-white">{opp.medicine_name}</h3>
                          <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                            Batch #{opp.batch_number}
                          </span>
                          {getPriorityBadge(opp.priority)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          📍 Source Facility: <strong className="text-slate-200">{opp.source_facility_name || opp.source_warehouse_name}</strong> • Category: {opp.category}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <div className="text-xs text-slate-400">Rescueable Surplus</div>
                        <div className="text-2xl font-black text-purple-400 font-mono">
                          +{opp.rescueable_surplus.toLocaleString()} {opp.unit}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Out of {opp.batch_quantity.toLocaleString()} total batch units
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block mb-0.5">Expiry Date & Timeline</span>
                        <strong className="text-amber-300 font-mono">{opp.expiry_date} ({opp.days_until_expiry} days remaining)</strong>
                      </div>

                      <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block mb-0.5">Expected Local Consumption</span>
                        <strong className="text-slate-200 font-mono">{opp.expected_local_consumption} units before expiry</strong>
                      </div>

                      <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block mb-0.5">FEFO Intelligence Reason</span>
                        <span className="text-purple-300 leading-snug">{opp.reason}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: All Batch Expiry Audit Table */}
          {activeTab === "all_batches" && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40 backdrop-blur shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/60">
                    <th className="px-6 py-4">Medicine & Batch</th>
                    <th className="px-6 py-4">Facility / Location</th>
                    <th className="px-6 py-4">Expiry Date</th>
                    <th className="px-6 py-4">Batch Qty</th>
                    <th className="px-6 py-4">Exp. Consumption</th>
                    <th className="px-6 py-4">Rescue Surplus</th>
                    <th className="px-6 py-4">FEFO Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No batch items match the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => (
                      <tr
                        key={b.batch_id}
                        className={`hover:bg-slate-700/20 transition-colors ${
                          b.is_rescue_candidate ? "bg-purple-950/10" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{b.medicine_name}</div>
                          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {b.batch_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                            {b.facility_name || b.warehouse_name}
                          </div>
                          <span className="text-xs text-slate-500 font-mono">{b.category}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-slate-200 font-semibold">{b.expiry_date}</div>
                          {getUrgencyBadge(b.urgency, b.days_until_expiry)}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-200">
                          {b.quantity.toLocaleString()} {b.unit}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-300">
                          {b.expected_consumption_before_expiry} {b.unit}
                          <div className="text-[10px] text-slate-500">{b.expected_daily_consumption}/day rate</div>
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {b.potential_expiring_surplus > 0 ? (
                            <span className="font-black text-purple-400">
                              +{b.potential_expiring_surplus.toLocaleString()} {b.unit}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-300 font-medium leading-relaxed">
                            {b.recommended_action}
                          </p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
