"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { TableSkeleton, EmptyState, ErrorState } from "../../components/skeletons";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Boxes,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  PackageCheck,
  PackageX,
  AlertCircle,
  Plus,
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

function StatusStepper({ status }: { status: TransferStatus }) {
  const steps: TransferStatus[] = ["PENDING", "APPROVED", "IN_TRANSIT", "RECEIVED"];
  if (status === "REJECTED" || status === "CANCELLED") {
    return <StatusBadge status={status} />;
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
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                isCurrent
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                  : isDone
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}
            >
              <span>{idx + 1}.</span>
              <span className="capitalize">{step.replace("_", " ").toLowerCase()}</span>
            </div>
            {idx < steps.length - 1 && <span className="text-slate-300 font-bold">→</span>}
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
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    transferId: string;
    action: "approve" | "dispatch" | "receive" | "reject" | "cancel";
    title: string;
    description: string;
    variant: "success" | "info" | "danger" | "warning";
  }>({
    isOpen: false,
    transferId: "",
    action: "approve",
    title: "",
    description: "",
    variant: "info",
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<StockTransfer[]>("/transfers");
      setTransfers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load stock transfers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const openConfirm = (
    transfer: StockTransfer,
    action: "approve" | "dispatch" | "receive" | "reject" | "cancel"
  ) => {
    const configMap = {
      approve: {
        title: `Approve Transfer ${transfer.tracking_number}`,
        description: `Are you sure you want to approve transfer of ${transfer.quantity} units of ${transfer.medicine_name}? Source safe surplus will be revalidated.`,
        variant: "info" as const,
      },
      dispatch: {
        title: `Dispatch Transfer ${transfer.tracking_number}`,
        description: `Mark ${transfer.quantity} units of ${transfer.medicine_name} as IN_TRANSIT. Physical stock will remain reserved until arrival.`,
        variant: "info" as const,
      },
      receive: {
        title: `Confirm Receipt for ${transfer.tracking_number}`,
        description: `Reconcile ${transfer.quantity} units of ${transfer.medicine_name} into destination inventory. Source inventory will be deducted (FEFO).`,
        variant: "success" as const,
      },
      reject: {
        title: `Reject Transfer ${transfer.tracking_number}`,
        description: `Reject transfer recommendation. Status will be marked REJECTED.`,
        variant: "danger" as const,
      },
      cancel: {
        title: `Cancel Transfer ${transfer.tracking_number}`,
        description: `Cancel this transfer. Status will be marked CANCELLED.`,
        variant: "warning" as const,
      },
    };

    const cfg = configMap[action];
    setConfirmModal({
      isOpen: true,
      transferId: transfer.id,
      action,
      title: cfg.title,
      description: cfg.description,
      variant: cfg.variant,
    });
  };

  const handleExecuteAction = async () => {
    const { transferId, action } = confirmModal;
    setActionLoading(true);
    setActionSuccess(null);
    setError(null);

    try {
      await api(`/transfers/${transferId}/${action}`, { method: "POST" });
      setActionSuccess(`Transfer action '${action.toUpperCase()}' completed successfully.`);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      await fetchTransfers();
    } catch (err: any) {
      setError(err.message || `Failed to perform ${action} on transfer.`);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = transfers.filter((t) => {
    const matchesTab = activeTab === "ALL" || t.status === activeTab;
    const matchesSearch =
      !search ||
      t.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      t.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.source_facility_name && t.source_facility_name.toLowerCase().includes(search.toLowerCase())) ||
      t.destination_facility_name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers & Logistics"
        subtitle="Track, approve, dispatch, and receive inter-facility medicine transfers across district supply nodes."
        breadcrumbs={[{ label: "Stock Transfers" }]}
        badgeText="Multi-Node Logistics"
      />

      {/* Feedback Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 font-bold">Dismiss</button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-semibold">
        {["ALL", "PENDING", "APPROVED", "IN_TRANSIT", "RECEIVED", "REJECTED", "CANCELLED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "border-teal-600 text-teal-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking number, medicine, facility..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          onClick={fetchTransfers}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchTransfers} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No stock transfers found"
          description="No transfer records match your current tab or filter search criteria."
          icon={Truck}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <div key={t.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-slate-900">{t.tracking_number}</span>
                  <StatusBadge status={t.status} />
                </div>
                <StatusStepper status={t.status} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Source Node</span>
                  <p className="font-bold text-slate-900">{t.source_facility_name || t.source_warehouse_name || "District Depot"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Destination Facility</span>
                  <p className="font-bold text-slate-900">{t.destination_facility_name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Medicine & Quantity</span>
                  <p className="font-bold text-teal-700">{t.medicine_name} — {t.quantity} {t.unit || "units"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Created At</span>
                  <p className="text-slate-600 font-mono">{new Date(t.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* State Machine Action Controls — Only legal transitions enabled */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 italic max-w-lg">{t.notes || "Standard transfer"}</p>

                <div className="flex items-center gap-2">
                  {t.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => openConfirm(t, "approve")}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-2xs"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openConfirm(t, "reject")}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {t.status === "APPROVED" && (
                    <>
                      <button
                        onClick={() => openConfirm(t, "dispatch")}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-2xs"
                      >
                        Dispatch 🚚
                      </button>
                      <button
                        onClick={() => openConfirm(t, "cancel")}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {t.status === "IN_TRANSIT" && (
                    <button
                      onClick={() => openConfirm(t, "receive")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-2xs"
                    >
                      Receive & Reconcile
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reusable Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        variant={confirmModal.variant}
        isLoading={actionLoading}
        onConfirm={handleExecuteAction}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
