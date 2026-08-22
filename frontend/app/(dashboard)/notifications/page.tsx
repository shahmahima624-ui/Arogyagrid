"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "../../../components/page-header";
import { StatusBadge } from "../../../components/status-badge";
import { EmptyState, TableSkeleton } from "../../../components/skeletons";
import { Bell, Check, ShieldAlert, Clock, Truck, Zap, Filter, Search } from "lucide-react";
import { api } from "../../../lib/api";

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Connect to SSE stream for live events and load mock/local events
    const initialEvents = [
      { id: "1", type: "STOCKOUT_RISK", severity: "CRITICAL", facility: "PHC Sanand", medicine: "Amoxicillin 500mg", message: "Stockout predicted in 2.3 days. Safe surplus available at CHC Bavla.", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), read: false },
      { id: "2", type: "EXPIRY_RISK", severity: "HIGH_RISK", facility: "CHC Bavla", medicine: "ORS Sachet", message: "Batch BAT-BAV-ORS expires in 28 days. 450 units rescueable.", timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), read: false },
      { id: "3", type: "TRANSFER_PENDING", severity: "RECOMMENDED", facility: "District Hospital Viramgam", medicine: "Paracetamol 500mg", message: "New AI transfer recommendation generated (Score: 3.42).", timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), read: true },
      { id: "4", type: "TRANSFER_DISPATCHED", severity: "IN_TRANSIT", facility: "PHC Sanand", medicine: "Azithromycin 250mg", message: "Transfer TRF-20260822-AB91C2 dispatched from CHC Bavla.", timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), read: true },
    ];
    setEvents(initialEvents);
    setLoading(false);
  }, []);

  const filtered = events.filter((e) => {
    const matchesType = filterType === "ALL" || e.type === filterType;
    const matchesSearch =
      !search ||
      e.message.toLowerCase().includes(search.toLowerCase()) ||
      e.facility.toLowerCase().includes(search.toLowerCase()) ||
      e.medicine.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const markAllRead = () => {
    setEvents(events.map((e) => ({ ...e, read: true })));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supply Notifications"
        subtitle="Real-time alerts for critical stock-out risks, expiry opportunities, and transfer lifecycle events."
        breadcrumbs={[{ label: "Notifications" }]}
        badgeText="Realtime Network Alerts"
        primaryAction={
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Check className="h-4 w-4 text-emerald-600" />
            Mark All as Read
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts by facility or medicine..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Alert Types</option>
            <option value="STOCKOUT_RISK">Stock-Out Risk</option>
            <option value="EXPIRY_RISK">Expiry Risk</option>
            <option value="TRANSFER_PENDING">Pending Transfer</option>
            <option value="TRANSFER_DISPATCHED">In Transit</option>
          </select>
        </div>
      </div>

      {/* Event List */}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No notifications found"
          description="There are no supply network alerts matching your current filter criteria."
          icon={Bell}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((evt) => (
            <div
              key={evt.id}
              className={`p-4 rounded-xl border transition-all flex items-start gap-4 ${
                evt.read ? "bg-white border-slate-200" : "bg-teal-50/30 border-teal-200 shadow-2xs"
              }`}
            >
              <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                {evt.type === "STOCKOUT_RISK" && <ShieldAlert className="h-5 w-5 text-rose-600" />}
                {evt.type === "EXPIRY_RISK" && <Clock className="h-5 w-5 text-amber-600" />}
                {evt.type.startsWith("TRANSFER") && <Truck className="h-5 w-5 text-indigo-600" />}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{evt.facility}</span>
                    <span className="text-xs font-medium text-slate-500">• {evt.medicine}</span>
                  </div>
                  <StatusBadge status={evt.severity} size="sm" />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{evt.message}</p>
                <p className="text-[11px] text-slate-400 font-medium pt-1">
                  {new Date(evt.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
