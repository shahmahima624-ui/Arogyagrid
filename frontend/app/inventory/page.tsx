"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { TableSkeleton, EmptyState, ErrorState } from "../../components/skeletons";
import { api } from "../../lib/api";
import { Boxes, Plus, Search, Filter, CheckCircle2, X } from "lucide-react";

type Item = {
  id: string;
  medicine_id: string;
  facility_id?: string;
  warehouse_id?: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
};

type Named = { id: string; name: string };

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [facilities, setFacilities] = useState<Named[]>([]);
  const [medicines, setMedicines] = useState<Named[]>([]);
  const [facility, setFacility] = useState("");
  const [medicine, setMedicine] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Item[]>(
        `/inventory${facility ? `?facility_id=${facility}` : ""}${
          facility && medicine ? "&" : !facility && medicine ? "?" : ""
        }${medicine ? `medicine_id=${medicine}` : ""}`
      );
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Failed to load inventory batches.");
    } finally {
      setLoading(false);
    }
  }, [facility, medicine]);

  useEffect(() => {
    api<Named[]>("/facilities").then(setFacilities).catch(() => {});
    api<Named[]>("/medicines").then(setMedicines).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const names = useMemo(() => new Map(medicines.map((x) => [x.id, x.name])), [medicines]);
  const facilityNames = useMemo(() => new Map(facilities.map((x) => [x.id, x.name])), [facilities]);

  const filteredItems = items.filter((item) => {
    const medName = names.get(item.medicine_id) || "";
    return (
      !search ||
      item.batch_number.toLowerCase().includes(search.toLowerCase()) ||
      medName.toLowerCase().includes(search.toLowerCase())
    );
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/inventory", {
        method: "POST",
        body: JSON.stringify({
          facility_id: data.get("facility_id"),
          medicine_id: data.get("medicine_id"),
          batch_number: data.get("batch_number"),
          quantity: Number(data.get("quantity")),
          expiry_date: data.get("expiry_date"),
        }),
      });
      setMessage("Inventory batch added successfully.");
      setShowAddModal(false);
      load();
    } catch (err: any) {
      setMessage(err.message || "Unable to add batch");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Inventory & Batches"
        subtitle="Manage batch-level stock quantities, FEFO expiration tracking, and multi-node inventory reserves."
        breadcrumbs={[{ label: "Medicine Inventory" }]}
        badgeText="Batch Ledger"
        primaryAction={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            Add Batch Record
          </button>
        }
      />

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage("")} className="text-emerald-600 font-bold">Dismiss</button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch number or medicine..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
          >
            <option value="">All Facilities</option>
            {facilities.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>

          <select
            className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={medicine}
            onChange={(e) => setMedicine(e.target.value)}
          >
            <option value="">All Medicines</option>
            {medicines.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No inventory batches found"
          description="No stock records match your selected facility or medicine filters."
          icon={Boxes}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Facility / Node</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Quantity Available</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {names.get(item.medicine_id) ?? item.medicine_id}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">
                      {item.facility_id ? facilityNames.get(item.facility_id) || "Facility" : "District Warehouse"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{item.batch_number}</td>
                    <td className="py-3 px-4 font-bold text-teal-700">{item.quantity.toLocaleString()} units</td>
                    <td className="py-3 px-4 text-slate-600">{item.expiry_date}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.quantity > 0 ? "HEALTHY" : "CRITICAL"} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900">Add Inventory Batch</h3>

            <form onSubmit={submit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facility Node</label>
                <select name="facility_id" required className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
                  <option value="">Select Facility</option>
                  {facilities.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medicine</label>
                <select name="medicine_id" required className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
                  <option value="">Select Medicine</option>
                  {medicines.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Batch Number</label>
                <input name="batch_number" required placeholder="BAT-2026-001" className="w-full h-9 px-3 rounded-lg border border-slate-300" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                <input name="quantity" type="number" min="1" required placeholder="500" className="w-full h-9 px-3 rounded-lg border border-slate-300" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expiry Date</label>
                <input name="expiry_date" type="date" required className="w-full h-9 px-3 rounded-lg border border-slate-300" />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 shadow-2xs">
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
