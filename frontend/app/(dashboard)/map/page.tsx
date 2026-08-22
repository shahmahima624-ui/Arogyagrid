"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "../../../lib/api";
import {
 MapPin,
 RefreshCw,
 Building2,
 Boxes,
 AlertTriangle,
 Clock,
 Truck,
 Info,
} from "lucide-react";

// Leaflet must be loaded client-side only (no SSR)
const LeafletMap = dynamic(() => import("../../../components/LeafletMap"), {
 ssr: false,
 loading: () => (
 <div className="flex items-center justify-center h-[520px] bg-white rounded-2xl border border-slate-200">
 <div className="text-slate-500 text-sm flex items-center gap-2">
 <RefreshCw className="h-4 w-4 animate-spin" />
 Loading map...
 </div>
 </div>
 ),
});

export interface FacilityMarker {
 id: string;
 name: string;
 facility_type: string;
 latitude: number;
 longitude: number;
 district_name: string;
 risk_color: string;
 risk_label: string;
 risk_score: number;
 total_stock_items: number;
 critical_medicines: number;
 expiring_soon: number;
 pending_transfers: number;
}

export interface TransferRoute {
 source_facility_id: string;
 destination_facility_id: string;
 source_lat: number;
 source_lng: number;
 destination_lat: number;
 destination_lng: number;
 medicine_name: string;
 quantity: number;
 status: string;
}

export interface MapData {
 markers: FacilityMarker[];
 transfer_routes: TransferRoute[];
 district_center_lat: number;
 district_center_lng: number;
 summary: Record<string, number>;
}

const COLOR_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
 green: { bg: "bg-white", text: "text-emerald-600", dot: "bg-emerald-400", border: "border-emerald-700" },
 yellow: { bg: "bg-white", text: "text-amber-600", dot: "bg-amber-400", border: "border-amber-700" },
 orange: { bg: "bg-white", text: "text-orange-600", dot: "bg-orange-500", border: "border-orange-700" },
 red: { bg: "bg-white", text: "text-rose-600", dot: "bg-rose-500", border: "border-rose-700" },
 purple: { bg: "bg-white", text: "text-purple-600", dot: "bg-purple-500", border: "border-purple-700" },
};

const LEGEND = [
 { color: "green", label: "Healthy" },
 { color: "yellow", label: "At Risk" },
 { color: "orange", label: "High Risk" },
 { color: "red", label: "Critical" },
 { color: "purple", label: "Expiry/Overstock" },
];

export default function GeoMapPage() {
 const [mapData, setMapData] = useState<MapData | null>(null);
 const [loading, setLoading] = useState(true);
 const [selected, setSelected] = useState<FacilityMarker | null>(null);

 const fetchMap = async () => {
 try {
 setLoading(true);
 const data = await api<MapData>("/map/facilities");
 setMapData(data);
 } catch (e) {
 console.error(e);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchMap();
 }, []);

 const summary = mapData?.summary || {};

 return (
 <>
 <main className="min-h-screen bg-white text-slate-900 pb-16">
 {/* Banner */}
 <div className="border-b border-slate-200 bg-white/95 px-4 sm:px-6 lg:px-8 py-6">
 <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <div className="flex items-center gap-2">
 <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
 <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
 Geographic Network Risk & Transfer Map
 </p>
 </div>
 <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
 <MapPin className="h-7 w-7 text-cyan-600" />
 Medicine Resilience Network
 </h1>
 <p className="mt-1 text-sm text-slate-500">
 Real-time facility risk map with transfer route overlays. Click any marker for detail.
 </p>
 </div>
 <button
 onClick={fetchMap}
 disabled={loading}
 className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-100 text-slate-600 text-sm font-bold flex items-center gap-2 transition-all"
 >
 <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
 Refresh
 </button>
 </div>
 </div>

 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
 {/* Summary Pills */}
 <div className="flex flex-wrap gap-3">
 {LEGEND.map(({ color, label }) => {
 const s = COLOR_STYLES[color];
 const count = summary[color] ?? 0;
 return (
 <div
 key={color}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${s.border} ${s.bg} text-xs font-bold ${s.text}`}
 >
 <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
 {label}: {count}
 </div>
 );
 })}
 {mapData && (
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 ml-auto">
 <Truck className="h-3.5 w-3.5 text-cyan-600" />
 {mapData.transfer_routes.length} Active Route{mapData.transfer_routes.length !== 1 ? "s" : ""}
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Map */}
 <div className="lg:col-span-2">
 {mapData ? (
 <LeafletMap
 markers={mapData.markers}
 routes={mapData.transfer_routes}
 centerLat={mapData.district_center_lat}
 centerLng={mapData.district_center_lng}
 onSelectMarker={setSelected}
 />
 ) : (
 <div className="flex items-center justify-center h-[520px] bg-slate-50 rounded-2xl border border-slate-200">
 <div className="text-slate-500 text-sm flex items-center gap-2">
 <RefreshCw className="h-4 w-4 animate-spin" />
 Loading map data...
 </div>
 </div>
 )}
 </div>

 {/* Side Panel */}
 <div className="space-y-4">
 {/* Legend */}
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 ">
 <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
 <Info className="h-4 w-4 text-cyan-600" />
 Risk Color Legend
 </h3>
 <div className="space-y-2">
 {LEGEND.map(({ color, label }) => {
 const s = COLOR_STYLES[color];
 return (
 <div key={color} className="flex items-center gap-2 text-xs">
 <span className={`h-3 w-3 rounded-full ${s.dot} shrink-0`} />
 <span className={`font-bold ${s.text}`}>{label}</span>
 </div>
 );
 })}
 <div className="flex items-center gap-2 text-xs mt-1 pt-2 border-t border-slate-200">
 <span className="h-0.5 w-6 bg-cyan-500 rounded" />
 <span className="text-cyan-600 font-bold">Transfer Route</span>
 </div>
 </div>
 </div>

 {/* Selected Facility Detail */}
 {selected ? (
 <div className={`rounded-2xl border ${COLOR_STYLES[selected.risk_color]?.border ?? "border-slate-200"} ${COLOR_STYLES[selected.risk_color]?.bg ?? "bg-slate-50"} p-4 `}>
 <div className="flex items-start justify-between gap-2 mb-3">
 <div>
 <h3 className="font-extrabold text-slate-900 text-base">{selected.name}</h3>
 <p className="text-xs text-slate-500 mt-0.5">{selected.facility_type} · {selected.district_name}</p>
 </div>
 <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${COLOR_STYLES[selected.risk_color]?.text ?? ""} ${COLOR_STYLES[selected.risk_color]?.bg ?? ""} border ${COLOR_STYLES[selected.risk_color]?.border ?? ""}`}>
 {selected.risk_label}
 </span>
 </div>

 <div className="grid grid-cols-2 gap-2 text-xs">
 <div className="bg-slate-50 rounded-lg p-2.5">
 <div className="text-slate-500 font-medium">Risk Score</div>
 <div className="text-white font-extrabold font-mono text-lg">
 {Math.round(selected.risk_score * 100)}%
 </div>
 </div>
 <div className="bg-slate-50 rounded-lg p-2.5">
 <div className="text-slate-500 font-medium">Stock Items</div>
 <div className="text-white font-extrabold font-mono text-lg">{selected.total_stock_items}</div>
 </div>
 <div className="bg-white rounded-lg p-2.5 border border-slate-200">
 <div className="text-rose-600 font-medium flex items-center gap-1">
 <AlertTriangle className="h-3 w-3" /> Critical Meds
 </div>
 <div className="text-rose-200 font-extrabold font-mono text-lg">{selected.critical_medicines}</div>
 </div>
 <div className="bg-white rounded-lg p-2.5 border border-slate-200">
 <div className="text-amber-600 font-medium flex items-center gap-1">
 <Clock className="h-3 w-3" /> Expiring Soon
 </div>
 <div className="text-amber-200 font-extrabold font-mono text-lg">{selected.expiring_soon}</div>
 </div>
 </div>

 <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
 <span className="text-cyan-600 font-bold">{selected.pending_transfers}</span> pending transfer(s) involving this facility
 </div>
 <div className="mt-1 text-xs text-slate-500 font-mono">
 📍 {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
 </div>
 </div>
 ) : (
 <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-slate-500 text-sm">
 <MapPin className="h-8 w-8 mx-auto mb-2 text-slate-600" />
 Click a facility marker on the map to see risk details
 </div>
 )}

 {/* Transfer Routes List */}
 {mapData && mapData.transfer_routes.length > 0 && (
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 ">
 <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
 <Truck className="h-4 w-4 text-cyan-600" />
 Active Transfer Routes
 </h3>
 <div className="space-y-2">
 {mapData.transfer_routes.slice(0, 6).map((r, i) => (
 <div key={i} className="text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-200">
 <div className="font-bold text-slate-700">{r.medicine_name}</div>
 <div className="text-slate-500 mt-0.5">Qty: <span className="text-cyan-600 font-mono font-bold">{r.quantity}</span></div>
 <div className={`mt-1 font-bold ${r.status === "IN_TRANSIT" ? "text-amber-600" : r.status === "APPROVED" ? "text-emerald-600" : "text-slate-500"}`}>
 {r.status}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </main>
 </>
 );
}
