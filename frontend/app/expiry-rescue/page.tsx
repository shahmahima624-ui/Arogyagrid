"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { TableSkeleton, EmptyState, ErrorState } from "../../components/skeletons";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export type RescuePriority = "HIGH" | "MEDIUM" | "LOW";

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

export interface ExpiryDashboardResponse {
  opportunities: RescueOpportunity[];
}

export default function ExpiryRescuePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ExpiryDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchExpiryData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await api<ExpiryDashboardResponse>("/expiry/dashboard");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load expiry rescue opportunities.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExpiryData();
  }, [fetchExpiryData]);

  const opps = data?.opportunities || [];

  const filteredOpps = opps.filter((item) =>
    !search ||
    item.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
    item.batch_number.toLowerCase().includes(search.toLowerCase()) ||
    (item.source_facility_name && item.source_facility_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Rescue Engine"
        subtitle="Identify near-expiry medicine batches with excess stock exceeding local demand, enabling proactive FEFO redistribution to prevent drug wastage."
        breadcrumbs={[{ label: "Expiry Rescue" }]}
        badgeText="FEFO Wastage Prevention"
        primaryAction={
          <button
            onClick={fetchExpiryData}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Scan Near-Expiry Batches
          </button>
        }
      />

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch number or medicine..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Opportunities List */}
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchExpiryData} />
      ) : filteredOpps.length === 0 ? (
        <EmptyState
          title="No rescue opportunities detected"
          description="All near-expiry medicine batches have adequate local consumption coverage. Zero stock wastage predicted."
          icon={Clock}
        />
      ) : (
        <div className="space-y-4">
          {filteredOpps.map((opp) => (
            <div key={opp.batch_id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{opp.medicine_name}</h3>
                    <p className="text-xs text-slate-500 font-mono">Batch {opp.batch_number} — Expires in {opp.days_until_expiry} days ({opp.expiry_date})</p>
                  </div>
                </div>

                <StatusBadge status={opp.priority === "HIGH" ? "CRITICAL" : "AT_RISK"} label={`Priority: ${opp.priority}`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Source Node</span>
                  <p className="font-bold text-slate-900">{opp.source_facility_name || opp.source_warehouse_name || "District Depot"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Batch Quantity</span>
                  <p className="font-bold text-slate-800">{opp.batch_quantity.toLocaleString()} {opp.unit}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Local Consumption</span>
                  <p className="font-bold text-slate-700">~{opp.expected_local_consumption.toLocaleString()} {opp.unit}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Rescueable Surplus</span>
                  <p className="font-bold text-teal-700">{opp.rescueable_surplus.toLocaleString()} {opp.unit}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed">
                {opp.reason}
              </p>

              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <Link
                  href={`/redistribution?medicine_id=${opp.medicine_id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs"
                >
                  Generate Rescue Transfer
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
