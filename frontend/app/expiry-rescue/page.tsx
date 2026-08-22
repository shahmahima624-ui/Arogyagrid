"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Clock,
  Sparkles,
  Boxes,
  Building2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Search,
  RefreshCw,
  TrendingDown,
  CheckCircle2,
  Layers,
} from "lucide-react";
import Link from "next/link";

export type RescuePriority = "HIGH" | "MEDIUM" | "LOW";
export type UrgencyTier = "CRITICAL_30" | "WARNING_60" | "ATTENTION_90" | "NORMAL";

export interface RescueOpportunity {
  batch_id: string;
  batch_number: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  source_facility_id?: string;
  source_facility_name?: string;
  source_warehouse_id?: string;
  source_warehouse_name?: string;
  expiry_date: string;
  days_until_expiry: number;
  batch_quantity: number;
  expected_local_consumption: number;
  rescueable_surplus: number;
  priority: RescuePriority;
  reason: string;
}

export interface BatchRiskItem {
  batch_id: string;
  batch_number: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  facility_id?: string;
  facility_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  quantity: number;
  expiry_date: string;
  days_until_expiry: number;
  urgency: UrgencyTier;
  expected_daily_consumption: number;
  expected_consumption_before_expiry: number;
  potential_expiring_surplus: number;
  is_rescue_candidate: boolean;
  recommended_action: string;
}

export interface ExpiryRescueDashboardData {
  kpis: {
    total_batches_monitored: number;
    expiring_soon_count: number;
    total_expiring_units: number;
    total_rescueable_surplus_units: number;
    most_vulnerable_facility: string;
    most_vulnerable_medicine: string;
  };
  rescue_opportunities: RescueOpportunity[];
  batch_risks: BatchRiskItem[];
  as_of: string;
}

export default function ExpiryRescuePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ExpiryRescueDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"opportunities" | "all_batches">("opportunities");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | RescuePriority>("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<"ALL" | UrgencyTier>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const fetchExpiryData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api<ExpiryRescueDashboardData>("/expiry-rescue");
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExpiryData();
  }, [fetchExpiryData]);

  const categories = Array.from(
    new Set(
      [
        ...(data?.rescue_opportunities.map((o) => o.category) || []),
        ...(data?.batch_risks.map((b) => b.category) || []),
      ].filter(Boolean)
    )
  );

  const filteredOpportunities = data?.rescue_opportunities.filter((o) => {
    const matchesPriority = priorityFilter === "ALL" || o.priority === priorityFilter;
    const matchesCategory = categoryFilter === "ALL" || o.category === categoryFilter;
    const matchesSearch =
      o.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.source_facility_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.batch_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPriority && matchesCategory && matchesSearch;
  }) || [];

  const filteredBatches = data?.batch_risks.filter((b) => {
    const matchesUrgency = urgencyFilter === "ALL" || b.urgency === urgencyFilter;
    const matchesCategory = categoryFilter === "ALL" || b.category === categoryFilter;
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            ⚡ {days}d left (≤30d)
          </span>
        );
      case "WARNING_60":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            ⏳ {days}d left (31-60d)
          </span>
        );
      case "ATTENTION_90":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            🕒 {days}d left (61-90d)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            ✓ {days}d left
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: RescuePriority) => {
    switch (priority) {
      case "HIGH":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">🔥 HIGH PRIORITY RESCUE</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⚡ MEDIUM PRIORITY</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">MONITOR SURPLUS</span>;
    }
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-slate-50 text-slate-900 pb-16">
        {/* Banner */}
        <div className="border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-5">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Expiry Rescue Engine & FEFO Optimization
                </p>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  {user?.role === "DISTRICT_ADMIN" ? "District Central Scope" : "Facility Scoped View"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <Clock className="h-7 w-7 text-amber-600" />
                Expiry Rescue Engine
              </h1>
            </div>

            <button
              onClick={fetchExpiryData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs font-bold transition-all shadow-2xs self-start md:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Scanning..." : "Rescan Batch Expiries"}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          {/* Top Hero KPI Cards */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Batches</span>
                <Boxes className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? "..." : (data?.kpis.total_batches_monitored ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">Monitored in Grid</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-amber-600">
                <span className="text-xs font-bold uppercase tracking-wider">Expiring &le; 90d</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-600">
                {loading ? "..." : (data?.kpis.expiring_soon_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">
                {data?.kpis.total_expiring_units.toLocaleString() ?? 0} total units
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-teal-600">
                <span className="text-xs font-bold uppercase tracking-wider">Rescueable Surplus</span>
                <Sparkles className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-teal-700">
                {loading ? "..." : (data?.kpis.total_rescueable_surplus_units.toLocaleString() ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">Units ready to redistribute</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Top Surplus Node</span>
                <Building2 className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="mt-2 text-base font-bold text-slate-900 truncate">
                {loading ? "..." : (data?.kpis.most_vulnerable_facility || "None")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
                Excess: {data?.kpis.most_vulnerable_medicine || "N/A"}
              </p>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 mb-6 pb-2">
            <button
              onClick={() => setActiveTab("opportunities")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "opportunities"
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${activeTab === "opportunities" ? "text-white" : "text-slate-400"}`} />
              <span>Expiry Rescue Candidates</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === "opportunities" ? "bg-teal-800 text-teal-100" : "bg-slate-100 text-slate-600"}`}>
                {data?.rescue_opportunities.length ?? 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all_batches")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "all_batches"
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Clock className={`h-3.5 w-3.5 ${activeTab === "all_batches" ? "text-white" : "text-slate-400"}`} />
              <span>All Batch Expiry Audit</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === "all_batches" ? "bg-teal-800 text-teal-100" : "bg-slate-100 text-slate-600"}`}>
                {data?.batch_risks.length ?? 0}
              </span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facility, medicine, or batch..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "opportunities" ? (
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
                  {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((prio) => (
                    <button
                      key={prio}
                      onClick={() => setPriorityFilter(prio)}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                        priorityFilter === prio
                          ? "bg-teal-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {prio === "ALL" ? "All Priorities" : `${prio} Priority`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
                  {(["ALL", "CRITICAL_30", "WARNING_60", "ATTENTION_90"] as const).map((urg) => (
                    <button
                      key={urg}
                      onClick={() => setUrgencyFilter(urg)}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                        urgencyFilter === urg
                          ? "bg-teal-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
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
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
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
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 font-medium shadow-2xs">
                  No active rescue candidates match the filter criteria.
                </div>
              ) : (
                filteredOpportunities.map((opp) => (
                  <div
                    key={opp.batch_id}
                    className="p-5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-all shadow-2xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">{opp.medicine_name}</h3>
                          <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold">
                            Batch #{opp.batch_number}
                          </span>
                          {getPriorityBadge(opp.priority)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          📍 Source Node: <strong className="text-slate-800">{opp.source_facility_name || opp.source_warehouse_name}</strong> • Category: {opp.category}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <div className="text-[11px] text-slate-500 font-medium">Rescueable Surplus</div>
                        <div className="text-2xl font-black text-teal-700 font-mono">
                          +{opp.rescueable_surplus.toLocaleString()} {opp.unit}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Out of {opp.batch_quantity.toLocaleString()} total batch units
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px] font-medium mb-0.5">Expiry Date & Timeline</span>
                        <strong className="text-amber-700 font-mono">{opp.expiry_date} ({opp.days_until_expiry} days remaining)</strong>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px] font-medium mb-0.5">Expected Local Consumption</span>
                        <strong className="text-slate-800 font-mono">{opp.expected_local_consumption} units before expiry</strong>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px] font-medium mb-0.5">FEFO Intelligence Reason</span>
                        <span className="text-slate-800 font-medium leading-snug">{opp.reason}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: All Batch Expiry Audit Table */}
          {activeTab === "all_batches" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                    <th className="px-6 py-3.5">Medicine & Batch</th>
                    <th className="px-6 py-3.5">Facility / Location</th>
                    <th className="px-6 py-3.5">Expiry Date</th>
                    <th className="px-6 py-3.5">Batch Qty</th>
                    <th className="px-6 py-3.5">Exp. Consumption</th>
                    <th className="px-6 py-3.5">Rescue Surplus</th>
                    <th className="px-6 py-3.5">FEFO Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No batch items match the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => (
                      <tr key={b.batch_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="font-bold text-slate-900">{b.medicine_name}</div>
                          <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            #{b.batch_number}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-teal-700" />
                            {b.facility_name || b.warehouse_name}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">{b.category}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="font-mono text-slate-800 font-bold">{b.expiry_date}</div>
                          {getUrgencyBadge(b.urgency, b.days_until_expiry)}
                        </td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-800">
                          {b.quantity.toLocaleString()} {b.unit}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-700">
                          {b.expected_consumption_before_expiry} {b.unit}
                          <div className="text-[10px] text-slate-500 font-normal">{b.expected_daily_consumption}/day rate</div>
                        </td>
                        <td className="px-6 py-3.5 font-mono">
                          {b.potential_expiring_surplus > 0 ? (
                            <span className="font-black text-teal-700">
                              +{b.potential_expiring_surplus.toLocaleString()} {b.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
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
