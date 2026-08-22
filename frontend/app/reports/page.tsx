"use client";

import React, { useState } from "react";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { api } from "../../lib/api";
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
  Building2,
  Boxes,
  Truck,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const reportsList = [
    {
      id: "inventory",
      title: "Medicine Stock & Batch Balance Report",
      description: "Complete batch-level ledger of all medicine stocks, expiry dates, and node allocations across district facilities.",
      type: "inventory",
      icon: Boxes,
      color: "text-teal-600 bg-teal-50 border-teal-200",
    },
    {
      id: "transfers",
      title: "Inter-Facility Transfer & Logistics Audit",
      description: "Detailed log of all requested, approved, dispatched, and received stock transfers with tracking numbers.",
      type: "transfers",
      icon: Truck,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
    {
      id: "audit",
      title: "District Audit Ledger & Mutation Events",
      description: "Immutable transaction logs tracking all system user actions, stock adjustments, and administrative overrides.",
      type: "audit",
      icon: ShieldCheck,
      color: "text-slate-600 bg-slate-100 border-slate-200",
    },
  ];

  const handleExportCsv = (type: string) => {
    setDownloading(type);
    window.open(`http://localhost:8000/api/reports/export-csv?type=${type}`, "_blank");
    setTimeout(() => setDownloading(null), 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Government & Operational Reports"
        subtitle="Export official district inventory reports, transfer dispatch manifests, and audit ledgers in CSV and PDF formats."
        breadcrumbs={[{ label: "Reports" }]}
        badgeText="Official Exports"
      />

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reportsList.map((rep) => {
          const Icon = rep.icon;
          return (
            <div key={rep.id} className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border w-fit ${rep.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{rep.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{rep.description}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => handleExportCsv(rep.type)}
                  disabled={downloading === rep.type}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloading === rep.type ? "Exporting..." : "Export Official CSV"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dispatch Manifest Section */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileText className="h-5 w-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-900">Government Dispatch Manifest Generator</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
          Generate an official district government transit authorization document for inter-facility medicine transfers. Includes security hash, authorized signatures, and vehicle transit metadata.
        </p>
        <div className="pt-2">
          <button
            onClick={() => handleExportCsv("transfers")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            Generate Transfer Manifest PDF
          </button>
        </div>
      </div>
    </div>
  );
}
