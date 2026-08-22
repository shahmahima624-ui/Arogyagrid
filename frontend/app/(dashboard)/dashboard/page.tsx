"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "../../../components/page-header";
import { StatusBadge } from "../../../components/status-badge";
import { CardSkeleton, TableSkeleton, EmptyState, ErrorState } from "../../../components/skeletons";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  Clock,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Zap,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";

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
  category_distribution: any[];
  activity_feed: ActivityFeedItem[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api<CommandCenterData>("/dashboard/command-center");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load Command Centre metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = data?.kpis;
  const criticalStockAlerts = data?.stock_alerts.filter((s) => s.status === "OUT_OF_STOCK" || s.status === "LOW_STOCK") || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="District Medicine Resilience"
        subtitle="Real-time operational monitoring of stock-out risks, AI transfer recommendations, expiry rescue opportunities, and network health."
        badgeText="District Operations"
        primaryAction={
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Metrics
          </button>
        }
      />

      {loading ? (
        <div className="space-y-6">
          <CardSkeleton count={4} />
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={() => fetchData()} />
      ) : (
        <div className="space-y-6">
          {/* Top KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Critical Stock-Outs</span>
                <ShieldAlert className="h-5 w-5 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-900">{kpis?.critical_facilities_count || 0}</p>
              <p className="text-[11px] font-medium text-rose-700">Facilities at immediate stockout risk</p>
            </div>

            <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">High-Risk Medicines</span>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-900">{kpis?.low_stock_items_count || 0}</p>
              <p className="text-[11px] font-medium text-amber-700">Stock balances below safety reserve</p>
            </div>

            <div className="p-5 rounded-xl border border-teal-200 bg-teal-50/40 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Expiry Rescue Opportunities</span>
                <Clock className="h-5 w-5 text-teal-600" />
              </div>
              <p className="text-2xl font-black text-teal-900">{kpis?.expiring_soon_count || 0}</p>
              <p className="text-[11px] font-medium text-teal-700">Batches expiring &lt; 90 days</p>
            </div>

            <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Pending Transfers</span>
                <Truck className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-indigo-900">{kpis?.pending_transfers_count || 0}</p>
              <p className="text-[11px] font-medium text-indigo-700">Awaiting human approval</p>
            </div>
          </div>

          {/* Section 1: Immediate Intervention Required */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Immediate Intervention Required</h2>
                  <p className="text-xs text-slate-500">Facilities requiring urgent redistribution intervention to prevent patient stockouts.</p>
                </div>
              </div>
              <Link
                href="/redistribution"
                className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1"
              >
                Generate AI Redistribution →
              </Link>
            </div>

            {criticalStockAlerts.length === 0 ? (
              <EmptyState
                title="No critical stockouts detected"
                description="AarogyaGrid is currently showing healthy inventory resilience across all monitored healthcare facilities."
                icon={CheckCircle2}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {criticalStockAlerts.slice(0, 4).map((alert, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-rose-200 bg-rose-50/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900">{alert.facility_name}</span>
                        <p className="text-xs font-bold text-rose-700 mt-0.5">{alert.medicine_name}</p>
                      </div>
                      <StatusBadge status={alert.status === "OUT_OF_STOCK" ? "CRITICAL" : "HIGH_RISK"} size="sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-rose-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Current Stock</span>
                        <p className="font-bold text-slate-900">{alert.current_stock} units</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Reorder Level</span>
                        <p className="font-bold text-slate-700">{alert.reorder_level} units</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Link
                        href={`/transfers?facility_id=${alert.facility_id}`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs"
                      >
                        Review Transfer Actions
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: District Facility Health Overview */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-900">District Facility Health Status</h2>
              </div>
              <Link href="/facilities" className="text-xs font-semibold text-teal-600 hover:text-teal-800">
                View All Facilities →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Facility</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Total Stock</th>
                    <th className="py-3 px-4">Low Stock Count</th>
                    <th className="py-3 px-4">Expiring Count</th>
                    <th className="py-3 px-4">Resilience Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {data?.facility_health.map((fac) => (
                    <tr key={fac.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{fac.name}</td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">{fac.facility_type}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{fac.total_stock.toLocaleString()} units</td>
                      <td className="py-3 px-4 text-amber-700 font-bold">{fac.low_stock_count}</td>
                      <td className="py-3 px-4 text-teal-700 font-bold">{fac.expiring_count}</td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={fac.status === "CRITICAL" ? "CRITICAL" : fac.status === "WARNING" ? "AT_RISK" : "HEALTHY"}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Recent Operational Activity */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-900">Recent Operational Activity</h2>
              </div>
              <Link href="/audit-logs" className="text-xs font-semibold text-teal-600 hover:text-teal-800">
                View Full Audit Logs →
              </Link>
            </div>

            <div className="space-y-2.5">
              {data?.activity_feed.slice(0, 5).map((act) => (
                <div key={act.id} className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900">{act.event_type}</span>
                    <p className="text-slate-600">{act.description}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
