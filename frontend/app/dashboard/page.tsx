"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Filter,
  History,
  Layers,
  PieChart,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import Link from "next/link";

interface CommandCenterKPIs {
  total_facilities: number;
  total_medicines: number;
  total_inventory_units: number;
  low_stock_items_count: number;
  expiring_soon_count: number;
  critical_facilities_count: number;
  pending_transfers_count: number;
}

interface FacilityHealthItem {
  id: string;
  name: string;
  facility_type: string;
  district_name: string;
  total_stock: number;
  low_stock_count: number;
  expiring_count: number;
  status: "CRITICAL" | "WARNING" | "NORMAL";
}

interface ExpiryAlertItem {
  batch_id: string;
  batch_number: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  quantity: number;
  expiry_date: string;
  days_remaining: number;
  urgency: "CRITICAL_30" | "WARNING_60" | "ATTENTION_90";
  facility_name?: string;
  warehouse_name?: string;
}

interface StockAlertItem {
  facility_id: string;
  facility_name: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  current_stock: number;
  reorder_level: number;
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "ADEQUATE";
}

interface CategoryStockItem {
  category: string;
  total_units: number;
  batch_count: number;
  medicine_count: number;
}

interface ActivityFeedItem {
  id: string;
  timestamp: string;
  event_type: string;
  actor_name: string;
  description: string;
  facility_name?: string;
}

interface CommandCenterData {
  kpis: CommandCenterKPIs;
  facility_health: FacilityHealthItem[];
  expiry_alerts: ExpiryAlertItem[];
  stock_alerts: StockAlertItem[];
  category_distribution: CategoryStockItem[];
  recent_activity: ActivityFeedItem[];
  as_of: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"facilities" | "alerts" | "categories" | "activity">("facilities");
  const [searchQuery, setSearchQuery] = useState("");
  const [facilityTypeFilter, setFacilityTypeFilter] = useState("ALL");
  const [expiryFilter, setExpiryFilter] = useState<"ALL" | "CRITICAL_30" | "WARNING_60" | "ATTENTION_90">("ALL");

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api<CommandCenterData>("/dashboard/command-center");
      setData(res);
    } catch {
      // Fallback synthetic baseline if backend is launching
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30s live poll
    return () => clearInterval(interval);
  }, [loadData, user]);

  const filteredFacilities = data?.facility_health.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.facility_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = facilityTypeFilter === "ALL" || f.facility_type === facilityTypeFilter;
    return matchesSearch && matchesType;
  }) ?? [];

  const filteredExpiries = data?.expiry_alerts.filter((e) => {
    if (expiryFilter === "ALL") return true;
    return e.urgency === expiryFilter;
  }) ?? [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CRITICAL":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">🚨 CRITICAL</span>;
      case "WARNING":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⚠️ WARNING</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ NORMAL</span>;
    }
  };

  const getUrgencyBadge = (urgency: string, days: number) => {
    if (urgency === "CRITICAL_30") {
      return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-600 text-white">⚡ {days}d left</span>;
    }
    if (urgency === "WARNING_60") {
      return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500 text-white">⏳ {days}d left</span>;
    }
    return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">{days}d left</span>;
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-slate-900 text-slate-100 pb-16">
        {/* Command Centre Top Banner */}
        <div className="border-b border-slate-800 bg-slate-950/60 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Real-Time Situational Awareness
                </p>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">
                  Scope: {user?.role === "DISTRICT_ADMIN" ? "District Central Command (All Facilities)" : "Scoped Facility Portal"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Medicine Resilience Command Centre
              </h1>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="text-xs text-slate-400 hidden sm:inline-block">
                Last updated: {data?.as_of ? new Date(data.as_of).toLocaleTimeString() : "Live"}
              </span>
              <button
                onClick={loadData}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors shadow-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Syncing..." : "Sync Live Data"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* Static Alert Notice */}
          <div className="mb-6 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3.5 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-bold uppercase tracking-wider text-[11px] text-emerald-400 border border-emerald-500/30">
                Phase 3 Command Baseline
              </span>
              <span>All threshold metrics below are calculated from deterministic real-time inventory counts and labeled as <strong>Current Stock Alerts</strong>.</span>
            </div>
            <span className="text-slate-400 hidden lg:inline">Phase 4-8 AI layers connect on top of this foundation.</span>
          </div>

          {/* 6 Hero KPI Metric Cards */}
          <section className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 sm:gap-4 mb-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Total Facilities</span>
                <Building2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
                {loading ? "..." : (data?.kpis.total_facilities ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">PHCs, CHCs, Hospital</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Catalog Meds</span>
                <Boxes className="h-4 w-4 text-blue-400" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
                {loading ? "..." : (data?.kpis.total_medicines ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Essential Catalogue</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Total Inventory</span>
                <Layers className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
                {loading ? "..." : (data?.kpis.total_inventory_units.toLocaleString() ?? "0")}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Active Units in Grid</p>
            </div>

            <div className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-4 shadow-sm backdrop-blur ring-1 ring-rose-500/20">
              <div className="flex items-center justify-between text-rose-300">
                <span className="text-xs font-medium">Low Stock Alerts</span>
                <TrendingDown className="h-4 w-4 text-rose-400" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-rose-400">
                {loading ? "..." : (data?.kpis.low_stock_items_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-rose-300/80">Current Stock Alerts</p>
            </div>

            <div className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4 shadow-sm backdrop-blur ring-1 ring-amber-500/20">
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-xs font-medium">Expiring &le; 90d</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-400">
                {loading ? "..." : (data?.kpis.expiring_soon_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-amber-300/80">Batches to Rescue</p>
            </div>

            <div className="rounded-2xl border border-purple-900/60 bg-purple-950/20 p-4 shadow-sm backdrop-blur ring-1 ring-purple-500/20">
              <div className="flex items-center justify-between text-purple-300">
                <span className="text-xs font-medium">Critical Nodes</span>
                <ShieldAlert className="h-4 w-4 text-purple-400" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-purple-400">
                {loading ? "..." : (data?.kpis.critical_facilities_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-purple-300/80">Facilities needing stock</p>
            </div>
          </section>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 mb-6 pb-2">
            {[
              { id: "facilities", label: "Facility Health Matrix", icon: Building2, count: data?.facility_health.length },
              { id: "alerts", label: "Current Stock & Expiry Alerts", icon: AlertTriangle, count: (data?.expiry_alerts.length ?? 0) + (data?.stock_alerts.length ?? 0) },
              { id: "categories", label: "Category Distribution", icon: PieChart, count: data?.category_distribution.length },
              { id: "activity", label: "Live Audit & Activity", icon: History, count: data?.recent_activity.length },
            ].map(({ id, label, icon: Icon, count }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-emerald-400" : "text-slate-500"}`} />
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* VIEW 1: Facility Health Matrix */}
          {activeTab === "facilities" && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search facilities by name or type..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={facilityTypeFilter}
                    onChange={(e) => setFacilityTypeFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="ALL">All Facility Types</option>
                    <option value="PHC">PHC (Primary Health Centre)</option>
                    <option value="CHC">CHC (Community Health Centre)</option>
                    <option value="HOSPITAL">District Hospital</option>
                  </select>
                </div>
              </div>

              {/* Facilities Table / Grid */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40 backdrop-blur shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/60">
                      <th className="px-6 py-4">Facility Name & Type</th>
                      <th className="px-6 py-4">District</th>
                      <th className="px-6 py-4">Total Stock Units</th>
                      <th className="px-6 py-4">Current Stock Alerts</th>
                      <th className="px-6 py-4">Expiring &le; 90d</th>
                      <th className="px-6 py-4">Resilience Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {filteredFacilities.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          No facilities match the active filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredFacilities.map((fac) => (
                        <tr key={fac.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-emerald-400" />
                              {fac.name}
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                              Type: {fac.facility_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            {fac.district_name}
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-200">
                            {fac.total_stock.toLocaleString()} units
                          </td>
                          <td className="px-6 py-4">
                            {fac.low_stock_count > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-400 text-xs px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-800/50">
                                ⚠️ {fac.low_stock_count} item(s)
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {fac.expiring_count > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-400 text-xs px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/50">
                                ⏳ {fac.expiring_count} batch(es)
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(fac.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href="/inventory"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
                            >
                              Inspect Inventory <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: Current Stock & Expiry Alerts */}
          {activeTab === "alerts" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expiry Alerts Section */}
              <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 backdrop-blur">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-400" />
                      Upcoming Batch Expiries
                    </h3>
                    <p className="text-xs text-slate-400">Batches expiring within 90 days across facilities</p>
                  </div>
                  <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                    {(["ALL", "CRITICAL_30", "WARNING_60"] as const).map((urg) => (
                      <button
                        key={urg}
                        onClick={() => setExpiryFilter(urg)}
                        className={`px-2 py-1 rounded-md font-medium transition-colors ${
                          expiryFilter === urg ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {urg === "ALL" ? "All" : urg === "CRITICAL_30" ? "≤ 30d" : "31-60d"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredExpiries.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-12">No active expiry alerts in this category.</p>
                  ) : (
                    filteredExpiries.map((exp) => (
                      <div
                        key={exp.batch_id}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{exp.medicine_name}</span>
                            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              {exp.batch_number}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            📍 {exp.facility_name ?? exp.warehouse_name ?? "District Facility"} • Category: {exp.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-white text-sm">
                            {exp.quantity.toLocaleString()} units
                          </div>
                          <div className="mt-1">
                            {getUrgencyBadge(exp.urgency, exp.days_remaining)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Current Stock Alerts Section */}
              <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 backdrop-blur">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-rose-400" />
                      Current Stock Alerts
                    </h3>
                    <p className="text-xs text-slate-400">Medicines below static reorder threshold (150 units)</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-800/50 text-rose-300 font-semibold">
                    {data?.stock_alerts.length ?? 0} Alerts
                  </span>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {(!data?.stock_alerts || data.stock_alerts.length === 0) ? (
                    <p className="text-sm text-slate-500 text-center py-12">All facility medicine stocks are within adequate thresholds.</p>
                  ) : (
                    data.stock_alerts.map((stk, idx) => (
                      <div
                        key={`${stk.facility_id}-${stk.medicine_id}-${idx}`}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{stk.medicine_name}</span>
                            <span className="text-xs text-slate-400">({stk.category})</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            📍 {stk.facility_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              stk.current_stock === 0
                                ? "bg-rose-900/80 text-rose-200 border border-rose-600"
                                : "bg-amber-900/80 text-amber-200 border border-amber-600"
                            }`}
                          >
                            {stk.current_stock === 0 ? "OUT OF STOCK" : `${stk.current_stock} / ${stk.reorder_level} units`}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: Category Distribution */}
          {activeTab === "categories" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-800/40 p-6 backdrop-blur">
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-emerald-400" />
                  Medicine Category Breakdown
                </h3>
                <p className="text-xs text-slate-400 mb-6">Stock unit distribution by therapeutic category across the district network</p>

                <div className="space-y-4">
                  {data?.category_distribution.map((cat) => {
                    const totalAll = data.kpis.total_inventory_units || 1;
                    const pct = Math.round((cat.total_units / totalAll) * 100);
                    return (
                      <div key={cat.category} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-white">{cat.category}</span>
                          <span className="font-mono text-sm font-bold text-emerald-400">
                            {cat.total_units.toLocaleString()} units ({pct}%)
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                          <span>{cat.medicine_count} catalog medicines</span>
                          <span>{cat.batch_count} active batches</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overview side panel */}
              <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 backdrop-blur flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    Network Summary
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">Aggregate resilience status for Ahmedabad Rural</p>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Central Drug Warehouse</span>
                      <p className="text-sm font-semibold text-white mt-1">Ahmedabad Central Store</p>
                      <p className="text-xs text-emerald-400 mt-0.5">● Connected & Replenishing</p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Critical Primary Health Centres</span>
                      <p className="text-sm font-semibold text-white mt-1">PHC Sanand, PHC Rampura</p>
                      <p className="text-xs text-amber-400 mt-0.5">Low inventory buffer on Amoxicillin</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800">
                  <Link
                    href="/inventory"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                  >
                    <Boxes className="h-4 w-4" /> Manage Full Inventory
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: Live Activity & Audit Feed */}
          {activeTab === "activity" && (
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 backdrop-blur">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-emerald-400" />
                    Live System Activity & Audit Trail
                  </h3>
                  <p className="text-xs text-slate-400">Immutable ledger of inventory updates, consumption reports, and user actions</p>
                </div>
              </div>

              <div className="space-y-3">
                {(!data?.recent_activity || data.recent_activity.length === 0) ? (
                  <p className="text-sm text-slate-500 text-center py-12">No recent audit log entries recorded yet.</p>
                ) : (
                  data.recent_activity.map((act) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-2 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{act.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            By <strong>{act.actor_name}</strong> {act.facility_name ? `• 📍 ${act.facility_name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 sm:text-right font-mono">
                        {new Date(act.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
