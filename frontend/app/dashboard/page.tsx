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
  Truck,
  Bot,
  Mic,
  ScanLine,
  MapPin,
  FileText,
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
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
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
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">🚨 CRITICAL</span>;
      case "WARNING":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⚠️ WARNING</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ NORMAL</span>;
    }
  };

  const getUrgencyBadge = (urgency: string, days: number) => {
    if (urgency === "CRITICAL_30") {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">⚡ {days}d remaining</span>;
    }
    if (urgency === "WARNING_60") {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⏳ {days}d remaining</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{days}d remaining</span>;
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-slate-50 text-slate-900 pb-16">
        {/* District Operations Top Header Banner */}
        <div className="border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-5">
          <div className="mx-auto max-w-screen-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-teal-600 animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  District Health Operations Platform (DHOP)
                </p>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  Jurisdiction: {user?.role === "DISTRICT_ADMIN" ? "District Central Command" : "Facility Unit"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Operational Command Centre
              </h1>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="text-xs text-slate-500 hidden sm:inline-block font-medium">
                Last updated: {data?.as_of ? new Date(data.as_of).toLocaleTimeString() : "Live"}
              </span>
              <button
                onClick={loadData}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs font-semibold transition-all shadow-2xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Updating..." : "Refresh Operations"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-6">
          {/* Status Notice */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 font-bold uppercase tracking-wider text-[10px]">
                Operational Network Active
              </span>
              <span className="font-medium text-slate-600">
                Unified monitoring online across <strong>PHCs, CHCs, and District Warehouses</strong>. Real-time telemetry active.
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-4 text-xs font-semibold text-slate-600">
              <Link href="/map" className="hover:text-teal-700 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-teal-600" /> Geo Map View
              </Link>
              <Link href="/transfers" className="hover:text-teal-700 flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-teal-600" /> Pending Transfers ({data?.kpis.pending_transfers_count ?? 0})
              </Link>
            </div>
          </div>

          {/* 5 Clean KPI Summary Cards */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Health Centers</span>
                <Building2 className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? "..." : (data?.kpis.total_facilities ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">PHCs, CHCs & Warehouses</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Catalog Medicines</span>
                <Boxes className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? "..." : (data?.kpis.total_medicines ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">Essential Medicine List</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Stock Units</span>
                <Layers className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? "..." : (data?.kpis.total_inventory_units.toLocaleString() ?? "0")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">District Inventory Count</p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-rose-600">
                <span className="text-xs font-bold uppercase tracking-wider">Low Stock Items</span>
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-rose-600">
                {loading ? "..." : (data?.kpis.low_stock_items_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">Below Threshold Level</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-amber-600">
                <span className="text-xs font-bold uppercase tracking-wider">Expiring &le; 90d</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-600">
                {loading ? "..." : (data?.kpis.expiring_soon_count ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">FEFO Rescue Candidates</p>
            </div>
          </section>

          {/* Operational View Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 mb-6 pb-2">
            {[
              { id: "facilities", label: "Health Center Operations", icon: Building2, count: data?.facility_health.length },
              { id: "alerts", label: "Stockout & Expiry Alerts", icon: AlertTriangle, count: (data?.expiry_alerts.length ?? 0) + (data?.stock_alerts.length ?? 0) },
              { id: "categories", label: "Category Breakdown", icon: PieChart, count: data?.category_distribution.length },
              { id: "activity", label: "Audit Feed", icon: History, count: data?.recent_activity.length },
            ].map(({ id, label, icon: Icon, count }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-slate-400"}`} />
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${active ? "bg-teal-800 text-teal-100" : "bg-slate-100 text-slate-600"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: Health Center Matrix */}
          {activeTab === "facilities" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search health centers by name or type..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent font-medium"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={facilityTypeFilter}
                    onChange={(e) => setFacilityTypeFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
                  >
                    <option value="ALL">All Health Center Types</option>
                    <option value="PHC">PHC (Primary Health Centre)</option>
                    <option value="CHC">CHC (Community Health Centre)</option>
                    <option value="HOSPITAL">District Hospital</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="px-6 py-3.5">Health Center Name & Type</th>
                      <th className="px-6 py-3.5">District</th>
                      <th className="px-6 py-3.5">Inventory Units</th>
                      <th className="px-6 py-3.5">Low Stock Items</th>
                      <th className="px-6 py-3.5">Near Expiry</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {filteredFacilities.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          No health centers match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredFacilities.map((fac) => (
                        <tr key={fac.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-teal-600" />
                              {fac.name}
                            </div>
                            <span className="text-[11px] text-slate-500 font-normal">
                              Type: {fac.facility_type}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-600 font-semibold">
                            {fac.district_name}
                          </td>
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-800">
                            {fac.total_stock.toLocaleString()} units
                          </td>
                          <td className="px-6 py-3.5">
                            {fac.low_stock_count > 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-700 text-[11px] px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                                ⚠️ {fac.low_stock_count} item(s)
                              </span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            {fac.expiring_count > 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 text-[11px] px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                                ⏳ {fac.expiring_count} batch(es)
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            {getStatusBadge(fac.status)}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <Link
                              href="/inventory"
                              className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-800 hover:underline"
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

          {/* TAB 2: Alerts Grid */}
          {activeTab === "alerts" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="h-4.5 w-4.5 text-amber-600" />
                      Near Expiry Medicine Batches
                    </h3>
                    <p className="text-xs text-slate-500">Expiring within 90 days across facilities</p>
                  </div>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                    {(["ALL", "CRITICAL_30", "WARNING_60"] as const).map((urg) => (
                      <button
                        key={urg}
                        onClick={() => setExpiryFilter(urg)}
                        className={`px-2 py-1 rounded transition-colors ${
                          expiryFilter === urg ? "bg-amber-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {urg === "ALL" ? "All" : urg === "CRITICAL_30" ? "≤ 30d" : "31-60d"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredExpiries.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No active expiry alerts in this tier.</p>
                  ) : (
                    filteredExpiries.map((exp) => (
                      <div
                        key={exp.batch_id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/50 transition-colors text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{exp.medicine_name}</span>
                            <span className="text-[11px] font-mono text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded">
                              #{exp.batch_number}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            📍 {exp.facility_name ?? exp.warehouse_name ?? "District Store"} • {exp.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900">
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

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <TrendingDown className="h-4.5 w-4.5 text-rose-600" />
                      Low Stock Threshold Alerts
                    </h3>
                    <p className="text-xs text-slate-500">Medicines below safety threshold (150 units)</p>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                    {data?.stock_alerts.length ?? 0} Alerts
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {(!data?.stock_alerts || data.stock_alerts.length === 0) ? (
                    <p className="text-xs text-slate-500 text-center py-10">All medicine stocks are within safety thresholds.</p>
                  ) : (
                    data.stock_alerts.map((stk, idx) => (
                      <div
                        key={`${stk.facility_id}-${stk.medicine_id}-${idx}`}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/50 transition-colors text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{stk.medicine_name}</span>
                            <span className="text-[11px] text-slate-500">({stk.category})</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            📍 {stk.facility_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                              stk.current_stock === 0
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
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

          {/* TAB 3: Category Breakdown */}
          {activeTab === "categories" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <PieChart className="h-4.5 w-4.5 text-teal-600" />
                  Medicine Category Distribution
                </h3>
                <p className="text-xs text-slate-500 mb-5">Inventory distribution across therapeutic categories</p>

                <div className="space-y-4">
                  {data?.category_distribution.map((cat) => {
                    const totalAll = data.kpis.total_inventory_units || 1;
                    const pct = Math.round((cat.total_units / totalAll) * 100);
                    return (
                      <div key={cat.category} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-1.5 text-xs">
                          <span className="font-bold text-slate-900">{cat.category}</span>
                          <span className="font-mono font-bold text-teal-700">
                            {cat.total_units.toLocaleString()} units ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 font-medium">
                          <span>{cat.medicine_count} catalog items</span>
                          <span>{cat.batch_count} active batches</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4.5 w-4.5 text-teal-600" />
                    District Overview
                  </h3>
                  <p className="text-xs text-slate-500 mb-5">Operational snapshot for District Health Administration</p>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 font-semibold">Central District Drug Store</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">Ahmedabad Central Warehouse</p>
                      <p className="text-teal-700 font-bold mt-1">● Active Reserve Stock</p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 font-semibold">Priority Facilities</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">PHC Sanand, PHC Rampura</p>
                      <p className="text-amber-700 font-bold mt-1">Stock monitoring active</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200">
                  <Link
                    href="/inventory"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Boxes className="h-4 w-4" /> Manage Medicine Inventory
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Audit Feed */}
          {activeTab === "activity" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-teal-600" />
                  Operational System Activity & Audit Trail
                </h3>
                <p className="text-xs text-slate-500">Real-time ledger of medicine transfers, consumption logs, and user actions</p>
              </div>

              <div className="space-y-2.5">
                {(!data?.recent_activity || data.recent_activity.length === 0) ? (
                  <p className="text-xs text-slate-500 text-center py-10">No recent activity logged.</p>
                ) : (
                  data.recent_activity.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100/50 transition-colors text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 p-1.5 rounded bg-teal-50 border border-teal-200 text-teal-700">
                          <Activity className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{act.description}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            By <strong>{act.actor_name}</strong> {act.facility_name ? `• 📍 ${act.facility_name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 sm:text-right font-mono">
                        {new Date(act.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Quick Actions Footer Bar */}
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Operational Actions & Modules
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Link
                href="/redistribution"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-teal-50/50 hover:border-teal-200 text-slate-800 hover:text-teal-900 font-bold transition-all"
              >
                <div className="p-1.5 rounded bg-teal-100/80 text-teal-800">
                  <Activity className="h-4 w-4" />
                </div>
                <span>AI Stock Redistribution</span>
              </Link>

              <Link
                href="/voice-reporting"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-teal-50/50 hover:border-teal-200 text-slate-800 hover:text-teal-900 font-bold transition-all"
              >
                <div className="p-1.5 rounded bg-blue-100/80 text-blue-800">
                  <Mic className="h-4 w-4" />
                </div>
                <span>Voice Inventory Report</span>
              </Link>

              <Link
                href="/register-digitisation"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-teal-50/50 hover:border-teal-200 text-slate-800 hover:text-teal-900 font-bold transition-all"
              >
                <div className="p-1.5 rounded bg-purple-100/80 text-purple-800">
                  <ScanLine className="h-4 w-4" />
                </div>
                <span>Register Image Scan</span>
              </Link>

              <Link
                href="/stress-simulator"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-teal-50/50 hover:border-teal-200 text-slate-800 hover:text-teal-900 font-bold transition-all"
              >
                <div className="p-1.5 rounded bg-amber-100/80 text-amber-800">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <span>Supply Stress Test</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
