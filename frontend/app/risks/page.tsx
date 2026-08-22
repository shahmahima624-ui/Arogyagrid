"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { TableSkeleton, EmptyState, ErrorState } from "../../components/skeletons";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
} from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRisks = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await api<RiskAssessmentResponse>("/risks");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to run risk assessment engine.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const risks = data?.risks || [];
  const kpis = data?.kpis;

  const filteredRisks = risks.filter((item) => {
    const matchesTier = selectedTier === "ALL" || item.risk_level === selectedTier;
    const matchesSearch =
      !searchQuery ||
      item.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.facility_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stockout Risk Engine"
        subtitle="Continuous monitoring of days-to-stockout across all network healthcare facilities based on predicted daily demand and safety reserves."
        breadcrumbs={[{ label: "Stockout Risks" }]}
        badgeText="Early Warning Radar"
        primaryAction={
          <button
            onClick={fetchRisks}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Re-Assess Risks
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Critical Risk (&lt;3d)</span>
          <p className="text-2xl font-black text-rose-900">{kpis?.critical_count || 0}</p>
          <p className="text-[11px] text-rose-700 font-medium">Immediate intervention needed</p>
        </div>
        <div className="p-5 rounded-xl border border-orange-200 bg-orange-50/40 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">High Risk (3-7d)</span>
          <p className="text-2xl font-black text-orange-900">{kpis?.high_risk_count || 0}</p>
          <p className="text-[11px] text-orange-700 font-medium">Redistribution recommended</p>
        </div>
        <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">At Risk (7-14d)</span>
          <p className="text-2xl font-black text-amber-900">{kpis?.at_risk_count || 0}</p>
          <p className="text-[11px] text-amber-700 font-medium">Monitor consumption trends</p>
        </div>
        <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Healthy (&gt;14d)</span>
          <p className="text-2xl font-black text-emerald-900">{kpis?.healthy_count || 0}</p>
          <p className="text-[11px] text-emerald-700 font-medium">Adequate safety stock</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-semibold">
        {["ALL", "CRITICAL", "HIGH_RISK", "AT_RISK", "HEALTHY"].map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedTier(tier)}
            className={`px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
              selectedTier === tier
                ? "border-teal-600 text-teal-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tier.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facility or medicine..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchRisks} />
      ) : filteredRisks.length === 0 ? (
        <EmptyState
          title="No stockout risk items found"
          description="No monitored medicine-facility pairs match your selected risk level."
          icon={ShieldAlert}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Usable Stock</th>
                  <th className="py-3 px-4">Pred. Daily Demand</th>
                  <th className="py-3 px-4">Time to Stockout</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRisks.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.facility_name}</td>
                    <td className="py-3 px-4 text-slate-800 font-bold">{item.medicine_name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.current_usable_stock.toLocaleString()} units</td>
                    <td className="py-3 px-4 font-bold text-teal-700">{item.predicted_daily_demand.toFixed(1)} / day</td>
                    <td className="py-3 px-4 font-bold">
                      <span className={item.risk_level === "CRITICAL" ? "text-rose-700" : item.risk_level === "HIGH_RISK" ? "text-orange-700" : "text-slate-800"}>
                        {item.stockout_time_label || `${item.days_to_stockout.toFixed(1)} days`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.risk_level} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href="/redistribution"
                        className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-800"
                      >
                        Intervene
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
