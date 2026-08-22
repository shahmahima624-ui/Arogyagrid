"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "../../../components/page-header";
import { StatusBadge } from "../../../components/status-badge";
import { EmptyState, TableSkeleton, ErrorState } from "../../../components/skeletons";
import { ScrollText, Search, Filter, ShieldCheck } from "lucide-react";
import { api } from "../../../lib/api";

interface AuditLogItem {
  id: string;
  user_id?: string;
  action: string;
  entity: string;
  entity_id?: string;
  description: string;
  facility_id?: string;
  timestamp: string;
}

export default function AuditLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuditLogItem[]>("/audit-logs");
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs from system ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchesAction = actionFilter === "ALL" || l.action === actionFilter;
    const matchesSearch =
      !search ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.entity.toLowerCase().includes(search.toLowerCase()) ||
      (l.action && l.action.toLowerCase().includes(search.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Audit Ledger"
        subtitle="Complete, tamper-evident transaction logs for all inventory adjustments, stock transfers, backup events, and administrative actions."
        breadcrumbs={[{ label: "Audit Logs" }]}
        badgeText="System Integrity"
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs by description or entity..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="TRANSFER_CREATED">TRANSFER_CREATED</option>
            <option value="TRANSFER_APPROVED">TRANSFER_APPROVED</option>
            <option value="TRANSFER_DISPATCHED">TRANSFER_DISPATCHED</option>
            <option value="TRANSFER_RECEIVED">TRANSFER_RECEIVED</option>
            <option value="BACKUP_CREATED">BACKUP_CREATED</option>
            <option value="BACKUP_RESTORED">BACKUP_RESTORED</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchLogs} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No audit logs recorded"
          description="No activity log entries match your filter criteria."
          icon={ScrollText}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-semibold">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 text-slate-800 max-w-md">
                      {log.description}
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
