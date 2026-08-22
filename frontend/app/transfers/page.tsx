"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Building2,
  Boxes,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  PackageCheck,
  PackageX,
  AlertCircle,
} from "lucide-react";

type TransferStatus = "PENDING" | "APPROVED" | "REJECTED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

interface StockTransfer {
  id: string;
  tracking_number: string;
  recommendation_id?: string;
  source_facility_id?: string;
  source_facility_name?: string;
  source_warehouse_id?: string;
  source_warehouse_name?: string;
  destination_facility_id: string;
  destination_facility_name: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  quantity: number;
  status: TransferStatus;
  created_by_user_name?: string;
  approved_by_user_name?: string;
  dispatched_at?: string;
  received_at?: string;
  notes?: string;
  created_at: string;
}

const STATUS_BADGES: Record<TransferStatus, { label: string; color: string; icon: any }> = {
  PENDING: { label: "Pending Approval", color: "bg-amber-950/80 text-amber-300 border-amber-700", icon: Clock },
  APPROVED: { label: "Approved for Transit", color: "bg-blue-950/80 text-blue-300 border-blue-700", icon: CheckCircle2 },
  IN_TRANSIT: { label: "In Transit 🚚", color: "bg-purple-950/80 text-purple-300 border-purple-700 animate-pulse", icon: Truck },
  RECEIVED: { label: "Received & Reconciled", color: "bg-emerald-950/80 text-emerald-300 border-emerald-700", icon: PackageCheck },
  REJECTED: { label: "Rejected", color: "bg-rose-950/80 text-rose-300 border-rose-700", icon: XCircle },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-slate-500 border-slate-200", icon: PackageX },
};

function StatusStepper({ status }: { status: TransferStatus }) {
  const steps: TransferStatus[] = ["PENDING", "APPROVED", "IN_TRANSIT", "RECEIVED"];
  if (status === "REJECTED" || status === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800">
        <XCircle className="h-3.5 w-3.5" />
        Transfer {status}
      </span>
    );
  }

  const currIdx = steps.indexOf(status);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      {steps.map((step, idx) => {
        const isDone = idx <= currIdx;
        const isCurrent = idx === currIdx;
        return (
          <React.Fragment key={step}>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
                isCurrent
                  ? "bg-emerald-600 text-slate-900 font-bold border-emerald-500 shadow-xs"
                  : isDone
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800 font-medium"
                  : "bg-slate-900 text-slate-500 border-slate-200"
              }`}
            >
              <span>{idx + 1}.</span>
              <span className="capitalize">{step.replace("_", " ").toLowerCase()}</span>
            </div>
            {idx < steps.length - 1 && <span className="text-slate-600 font-bold">→</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function StockTransfersPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const data = await api<StockTransfer[]>(`/transfers${params}`);
      setTransfers(data);
    } catch (err) {
      console.error("Failed to load transfers", err);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleAction = async (transferId: string, action: "approve" | "dispatch" | "receive" | "reject" | "cancel") => {
    try {
      setActionLoading(`${transferId}-${action}`);
      setActionSuccess(null);
      await api<StockTransfer>(`/transfers/${transferId}/${action}`, { method: "POST" });
      setActionSuccess(`Transfer ${action}d successfully.`);
      await fetchTransfers();
    } catch (err: any) {
      alert(`Action failed: ${err.message || "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = transfers.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      t.tracking_number.toLowerCase().includes(q) ||
      t.medicine_name.toLowerCase().includes(q) ||
      t.destination_facility_name.toLowerCase().includes(q) ||
      (t.source_facility_name || "").toLowerCase().includes(q) ||
      (t.source_warehouse_name || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const statuses = ["ALL", "PENDING", "APPROVED", "IN_TRANSIT", "RECEIVED", "REJECTED", "CANCELLED"];

  // KPIs
  const pendingCount = transfers.filter((t) => t.status === "PENDING").length;
  const inTransitCount = transfers.filter((t) => t.status === "IN_TRANSIT").length;
  const receivedCount = transfers.filter((t) => t.status === "RECEIVED").length;
  const totalUnitsMoved = transfers
    .filter((t) => t.status === "RECEIVED")
    .reduce((acc, t) => acc + t.quantity, 0);

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white text-slate-900 pb-16">
        {/* Banner */}
        <div className="border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Phase 9 — Human Approval & Inventory Reconciliation
                </p>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-500">Real-time Batch Reconciliation</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <Truck className="h-7 w-7 text-emerald-400" />
                Stock Transfer Operations
              </h1>
            </div>

            <button
              onClick={fetchTransfers}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-700 border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors self-start md:self-auto shadow-xs"
            >
              <RefreshCw className={`h-4 w-4 text-emerald-400 ${loading ? "animate-spin" : ""}`} />
              Refresh Transfers
            </button>
          </div>

          {actionSuccess && (
            <div className="mx-auto max-w-7xl mt-4">
              <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-2.5 text-xs text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {actionSuccess}
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* KPI Summary Row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-2xl border border-amber-900/80 bg-amber-950/20 p-4 backdrop-blur ring-1 ring-amber-500/20">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Pending Approval</div>
              <div className="text-3xl font-black text-amber-400 mt-1">{loading ? "..." : pendingCount}</div>
              <div className="text-[11px] text-amber-300/70 mt-0.5">Awaiting admin review</div>
            </div>

            <div className="rounded-2xl border border-purple-900/80 bg-purple-950/20 p-4 backdrop-blur ring-1 ring-purple-500/20">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">In Transit 🚚</div>
              <div className="text-3xl font-black text-purple-400 mt-1">{loading ? "..." : inTransitCount}</div>
              <div className="text-[11px] text-purple-300/70 mt-0.5">Stock en route</div>
            </div>

            <div className="rounded-2xl border border-emerald-900/80 bg-emerald-950/20 p-4 backdrop-blur ring-1 ring-emerald-500/20">
              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Completed Transfers</div>
              <div className="text-3xl font-black text-emerald-400 mt-1">{loading ? "..." : receivedCount}</div>
              <div className="text-[11px] text-emerald-300/70 mt-0.5">Inventory reconciled</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 backdrop-blur">
              <div className="text-xs text-slate-500">Total Units Reconciled</div>
              <div className="text-3xl font-black text-slate-900 mt-1">{loading ? "..." : totalUnitsMoved.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Stock moved in network</div>
            </div>
          </section>

          {/* Filter Bar */}
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracking #, medicine, facility..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === s ? "bg-emerald-600 text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s === "ALL" ? "All Transfers" : s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Transfers List */}
          {loading ? (
            <div className="text-center text-slate-500 py-12">Loading stock transfers...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-slate-500">
              No stock transfers match the filter criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((t) => {
                const BadgeIcon = STATUS_BADGES[t.status]?.icon || AlertCircle;
                const srcName = t.source_facility_name || t.source_warehouse_name || "Network Source";

                return (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white backdrop-blur hover:border-slate-200 transition-all shadow-xs"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs font-black text-slate-600 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200">
                            {t.tracking_number}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_BADGES[t.status]?.color}`}>
                            <BadgeIcon className="h-3.5 w-3.5" />
                            {STATUS_BADGES[t.status]?.label}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-emerald-400" />
                            {srcName}
                          </div>
                          <span className="text-slate-500 font-bold">→</span>
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-400" />
                            {t.destination_facility_name}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="text-purple-300 font-semibold">{t.medicine_name}</span>
                          <span>•</span>
                          <span>Category: {t.category}</span>
                          {t.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 italic">&quot;{t.notes}&quot;</span>
                            </>
                          )}

                        </div>
                      </div>

                      {/* Right: Quantity & Action Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-slate-500">Transfer Qty</div>
                          <div className="text-2xl font-black text-emerald-400 font-mono">
                            {t.quantity.toLocaleString()} {t.unit}
                          </div>
                        </div>

                        {/* Workflow Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleAction(t.id, "approve")}
                                disabled={!!actionLoading}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-slate-900 transition-all shadow-xs"
                              >
                                Approve Transfer
                              </button>
                              <button
                                onClick={() => handleAction(t.id, "reject")}
                                disabled={!!actionLoading}
                                className="px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-700 text-xs font-bold text-rose-300 transition-all"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {t.status === "APPROVED" && (
                            <button
                              onClick={() => handleAction(t.id, "dispatch")}
                              disabled={!!actionLoading}
                              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-slate-900 transition-all shadow-xs flex items-center gap-1.5"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              Dispatch Transit
                            </button>
                          )}

                          {(t.status === "IN_TRANSIT" || t.status === "APPROVED") && (
                            <button
                              onClick={() => handleAction(t.id, "receive")}
                              disabled={!!actionLoading}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-extrabold text-slate-900 transition-all shadow-lg shadow-emerald-950 flex items-center gap-1.5"
                            >
                              <PackageCheck className="h-4 w-4" />
                              Confirm Receipt & Reconcile Stock
                            </button>
                          )}

                          {t.status !== "RECEIVED" && t.status !== "CANCELLED" && t.status !== "REJECTED" && (
                            <button
                              onClick={() => handleAction(t.id, "cancel")}
                              disabled={!!actionLoading}
                              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-semibold text-slate-500 transition-all"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stepper Row */}
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
                      <StatusStepper status={t.status} />
                      <div className="text-[11px] text-slate-500 font-mono">
                        Created: {new Date(t.created_at).toLocaleDateString("en-IN")}
                        {t.received_at && ` • Reconciled: ${new Date(t.received_at).toLocaleDateString("en-IN")}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
