"use client";

import React, { useState } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import {
 FileSpreadsheet,
 Download,
 Printer,
 ShieldCheck,
 FileText,
 Building2,
 Boxes,
 Truck,
 History,
 CheckCircle2,
} from "lucide-react";

interface DispatchManifest {
 transfer_id: string;
 tracking_number: string;
 issued_at: string;
 government_header: string;
 district_name: string;
 source_facility_name: string;
 source_address?: string;
 destination_facility_name: string;
 destination_address?: string;
 medicine_name: string;
 generic_name: string;
 unit: string;
 quantity: number;
 batch_number?: string;
 expiry_date?: string;
 status: string;
 transport_mode: string;
 authorized_by: string;
 security_hash: string;
}

export default function ReportsPage() {
 const [manifest, setManifest] = useState<DispatchManifest | null>(null);
 const [loadingManifest, setLoadingManifest] = useState(false);

 const handleExportCsv = (type: "inventory" | "transfers" | "audit") => {
 window.open(`/api/reports/export-csv?type=${type}`, "_blank");
 };

 const handleGenerateSampleManifest = async () => {
 try {
 setLoadingManifest(true);
 // Demo mock transfer ID
 const demoId = "11111111-1111-1111-1111-111111111111";
 const res = await api<DispatchManifest>(`/reports/dispatch-manifest/${demoId}`);
 setManifest(res);
 } catch (err: any) {
 // Fallback synthetic manifest for demo print preview
 setManifest({
 transfer_id: "demo-tx-999",
 tracking_number: "TRK-GUJ-2026-8842",
 issued_at: new Date().toISOString(),
 government_header: "GOVERNMENT OF INDIA — NATIONAL HEALTH MISSION",
 district_name: "Ahmedabad Rural",
 source_facility_name: "CHC Bavla (Surplus Center)",
 source_address: "Bavla Highway Road, Sector 4, Ahmedabad",
 destination_facility_name: "PHC Sanand (Critical Facility)",
 destination_address: "Sanand Main Health Complex, District Hospital Road",
 medicine_name: "ORS Powder (Oral Rehydration Salts)",
 generic_name: "Oral Rehydration Salts IP",
 unit: "sachets",
 quantity: 500,
 batch_number: "ORS-2026-09A",
 expiry_date: "2027-06-30",
 status: "APPROVED",
 transport_mode: "Government Cold-Chain Courier / Ambulance Dispatch",
 authorized_by: "Dr. District Medical Supply Officer",
 security_hash: "9A8F-4B7C-11EE-9902",
 });
 } finally {
 setLoadingManifest(false);
 }
 };

 return (
 <>
 <Nav />
 <main className="min-h-screen bg-white text-slate-900 pb-16">
 {/* Banner */}
 <div className="border-b border-slate-200 bg-white/95 px-4 sm:px-6 lg:px-8 py-6">
 <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <div className="flex items-center gap-2">
 <span className="flex h-2.5 w-2.5 rounded-full bg-blue-400 animate-ping" />
 <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
 National Health Mission Reports & Manifests
 </p>
 </div>
 <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
 <FileSpreadsheet className="h-7 w-7 text-blue-600" />
 Government Audit Reports & Dispatch Manifests
 </h1>
 <p className="mt-1 text-sm text-slate-500">
 Export real-time database audits to CSV or print official National Health Mission stock dispatch receipts.
 </p>
 </div>
 </div>
 </div>

 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
 {/* CSV Export Cards */}
 <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-white text-blue-600 border border-slate-200">
 <Boxes className="h-6 w-6" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-base">Inventory Audit CSV</h3>
 <p className="text-xs text-slate-500">Full facility stock levels & expiry dates</p>
 </div>
 </div>
 <button
 onClick={() => handleExportCsv("inventory")}
 className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-slate-900 font-bold text-xs transition-all flex items-center justify-center gap-2"
 >
 <Download className="h-4 w-4" />
 Export Inventory CSV
 </button>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-white text-purple-600 border border-slate-200">
 <Truck className="h-6 w-6" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-base">Stock Transfers CSV</h3>
 <p className="text-xs text-slate-500">Inter-facility dispatch history</p>
 </div>
 </div>
 <button
 onClick={() => handleExportCsv("transfers")}
 className="w-full px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-slate-900 font-bold text-xs transition-all flex items-center justify-center gap-2"
 >
 <Download className="h-4 w-4" />
 Export Transfers CSV
 </button>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-white text-emerald-600 border border-slate-200">
 <History className="h-6 w-6" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-base">Security Audit Logs CSV</h3>
 <p className="text-xs text-slate-500">System actions, approvals & logins</p>
 </div>
 </div>
 <button
 onClick={() => handleExportCsv("audit")}
 className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-slate-900 font-bold text-xs transition-all flex items-center justify-center gap-2"
 >
 <Download className="h-4 w-4" />
 Export Audit Logs CSV
 </button>
 </div>
 </section>

 {/* Official Dispatch Manifest Printable Receipt */}
 <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-6">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
 <div>
 <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
 <FileText className="h-5 w-5 text-blue-600" />
 Printable Stock Transfer Dispatch Manifest
 </h2>
 <p className="text-xs text-slate-500 mt-0.5">
 Official National Health Mission courier transit manifest with cryptographic verification hash.
 </p>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={handleGenerateSampleManifest}
 disabled={loadingManifest}
 className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-slate-900 font-bold text-xs transition-all flex items-center gap-1.5"
 >
 <FileText className="h-4 w-4" />
 Generate Official Manifest
 </button>
 {manifest && (
 <button
 onClick={() => window.print()}
 className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 border border-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5"
 >
 <Printer className="h-4 w-4" />
 Print Manifest PDF
 </button>
 )}
 </div>
 </div>

 {manifest && (
 <div className="bg-slate-50 p-8 rounded-2xl border-2 border-slate-200 text-slate-700 space-y-6 font-mono print:bg-white print:text-black">
 {/* Header */}
 <div className="text-center border-b border-slate-200 pb-4">
 <div className="text-xs font-bold text-blue-600 uppercase tracking-widest">
 {manifest.government_header}
 </div>
 <h3 className="text-xl font-extrabold text-slate-900 mt-1">
 INTER-FACILITY MEDICINE DISPATCH MANIFEST
 </h3>
 <p className="text-xs text-slate-500 mt-1">
 District: {manifest.district_name} • Issued: {new Date(manifest.issued_at).toLocaleString()}
 </p>
 </div>

 {/* Details Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
 <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
 <div className="text-slate-500 font-bold uppercase tracking-wider">Source Facility (Consignor)</div>
 <div className="font-extrabold text-slate-900 text-sm">{manifest.source_facility_name}</div>
 <div className="text-slate-500">{manifest.source_address}</div>
 </div>

 <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
 <div className="text-slate-500 font-bold uppercase tracking-wider">Destination Facility (Consignee)</div>
 <div className="font-extrabold text-emerald-600 text-sm">{manifest.destination_facility_name}</div>
 <div className="text-slate-500">{manifest.destination_address}</div>
 </div>
 </div>

 {/* Medicine Table */}
 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <table className="w-full text-xs text-left">
 <thead className="bg-white text-slate-500 uppercase">
 <tr>
 <th className="p-3">Tracking Number</th>
 <th className="p-3">Medicine Description</th>
 <th className="p-3">Batch No</th>
 <th className="p-3">Quantity</th>
 <th className="p-3">Expiry Date</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800">
 <tr>
 <td className="p-3 font-bold text-blue-600">{manifest.tracking_number}</td>
 <td className="p-3 font-bold text-slate-900">{manifest.medicine_name} ({manifest.generic_name})</td>
 <td className="p-3 text-slate-600">{manifest.batch_number}</td>
 <td className="p-3 font-bold text-emerald-600">{manifest.quantity} {manifest.unit}</td>
 <td className="p-3 text-amber-600">{manifest.expiry_date}</td>
 </tr>
 </tbody>
 </table>
 </div>

 {/* Verification Footer */}
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs">
 <div>
 <span className="text-slate-500 block">Transport Protocol:</span>
 <span className="font-bold text-slate-700">{manifest.transport_mode}</span>
 </div>
 <div>
 <span className="text-slate-500 block">Authorized By:</span>
 <span className="font-bold text-slate-700">{manifest.authorized_by}</span>
 </div>
 <div className="text-right">
 <span className="text-slate-500 block">Security Verification Hash:</span>
 <span className="font-bold font-mono text-purple-600 bg-white px-2 py-1 rounded border border-slate-200">
 {manifest.security_hash}
 </span>
 </div>
 </div>
 </div>
 )}
 </section>
 </div>
 </main>
 </>
 );
}
