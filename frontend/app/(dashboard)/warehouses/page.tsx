"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "../../../components/page-header";
import { StatusBadge } from "../../../components/status-badge";
import { EmptyState, TableSkeleton, ErrorState } from "../../../components/skeletons";
import { Warehouse as WarehouseIcon, Boxes, Truck, MapPin, Search } from "lucide-react";
import { api } from "../../../lib/api";

interface WarehouseItem {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: string;
}

interface InventoryItem {
  id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  medicine_id: string;
  warehouse_id?: string;
}

export default function WarehousesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedWh, setSelectedWh] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const whData = await api<WarehouseItem[]>("/warehouses");
      setWarehouses(whData);
      if (whData.length > 0) setSelectedWh(whData[0].id);

      const invData = await api<InventoryItem[]>("/inventory");
      setInventory(invData);
    } catch (err: any) {
      setError(err.message || "Failed to load district warehouses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentWh = warehouses.find((w) => w.id === selectedWh);
  const whBatches = inventory.filter((b) => b.warehouse_id === selectedWh);
  const totalStock = whBatches.reduce((acc, b) => acc + b.quantity, 0);

  const filteredBatches = whBatches.filter((b) =>
    !search || b.batch_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="District Warehouses & Buffer Stock"
        subtitle="Central storage facilities supplying district healthcare nodes and holding emergency medicine reserves."
        breadcrumbs={[{ label: "Warehouses" }]}
        badgeText="District Buffer Nodes"
      />

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchData} />
      ) : warehouses.length === 0 ? (
        <EmptyState
          title="No warehouses configured"
          description="No district warehouses have been registered in the system."
          icon={WarehouseIcon}
        />
      ) : (
        <div className="space-y-6">
          {/* Warehouse Switcher Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map((wh) => (
              <button
                key={wh.id}
                onClick={() => setSelectedWh(wh.id)}
                className={`p-5 rounded-xl border text-left transition-all ${
                  selectedWh === wh.id
                    ? "bg-white border-teal-600 ring-2 ring-teal-600/20 shadow-md"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
                      <WarehouseIcon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{wh.name}</h3>
                  </div>
                  <StatusBadge status={wh.status} size="sm" />
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{wh.address || "District Headquarters Depot"}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Selected Warehouse Stock Details */}
          {currentWh && (
            <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{currentWh.name} — Inventory Batches</h2>
                  <p className="text-xs text-slate-500">
                    Total buffer stock stored: <span className="font-bold text-slate-800">{totalStock.toLocaleString()} units</span>
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search batch number..."
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {filteredBatches.length === 0 ? (
                <EmptyState
                  title="No warehouse stock records"
                  description="This warehouse currently has no active inventory batches stored."
                  icon={Boxes}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Batch Number</th>
                        <th className="py-3 px-4">Quantity Stored</th>
                        <th className="py-3 px-4">Expiry Date</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.batch_number}</td>
                          <td className="py-3 px-4 text-slate-800 font-bold">{b.quantity.toLocaleString()} units</td>
                          <td className="py-3 px-4 text-slate-600">{b.expiry_date}</td>
                          <td className="py-3 px-4">
                            <StatusBadge status={b.quantity > 0 ? "HEALTHY" : "CRITICAL"} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
