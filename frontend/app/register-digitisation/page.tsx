"use client";

import React, { useState, useRef } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import Image from "next/image";
import {
  ScanLine,
  Upload,
  Sparkles,
  FileSpreadsheet,
  Edit3,
  Save,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  AlertTriangle,
  Boxes,
  Calendar,
  Hash,
} from "lucide-react";

interface RegisterRowDraft {
  medicine_name: string;
  medicine_id?: string;
  batch_number?: string;
  opening_stock?: number;
  received_stock?: number;
  consumed_stock?: number;
  closing_stock?: number;
  expiry_date?: string;
  confidence_score: number;
  notes?: string;
}

interface ExtractionResponse {
  rows: RegisterRowDraft[];
  model_used: string;
  image_reference?: string;
  page_description?: string;
  extracted_fields: string[];
}

interface SubmitResponse {
  success: boolean;
  facility_name: string;
  rows_updated: number;
  message: string;
}

const COLUMNS = [
  { key: "medicine_name", label: "Medicine", type: "text", width: "min-w-[160px]", color: "text-white" },
  { key: "batch_number", label: "Batch No.", type: "text", width: "min-w-[110px]", color: "text-slate-600" },
  { key: "opening_stock", label: "Opening", type: "number", width: "min-w-[80px]", color: "text-blue-300" },
  { key: "received_stock", label: "Received", type: "number", width: "min-w-[80px]", color: "text-emerald-300" },
  { key: "consumed_stock", label: "Consumed", type: "number", width: "min-w-[80px]", color: "text-rose-300" },
  { key: "closing_stock", label: "Closing", type: "number", width: "min-w-[80px]", color: "text-amber-300" },
  { key: "expiry_date", label: "Expiry", type: "text", width: "min-w-[110px]", color: "text-purple-300" },
];

export default function RegisterDigitisationPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageRef, setImageRef] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<RegisterRowDraft[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [pageDescription, setPageDescription] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageRef(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setPreviewUrl(dataUrl);
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUseSampleImage = () => {
    setPreviewUrl("/sample_register.png");
    setImageBase64(null); // No base64 — will use deterministic fallback
    setImageRef("sample_register.png");
  };

  const handleExtract = async () => {
    if (!previewUrl || loading) return;

    try {
      setLoading(true);
      setSubmitResult(null);

      const res = await api<ExtractionResponse>("/register/extract", {
        method: "POST",
        body: JSON.stringify({
          image_base64: imageBase64 || null,
          image_reference: imageRef || "uploaded_register.jpg",
        }),
      });

      setRows(res.rows);
      setModelUsed(res.model_used);
      setPageDescription(res.page_description || null);
    } catch (err: any) {
      alert(`Extraction failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRowChange = (idx: number, field: keyof RegisterRowDraft, value: any) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    setRows(updated);
  };

  const handleSubmit = async () => {
    const facilityId = user?.facility_id || "11111111-1111-1111-1111-111111111111";
    try {
      setSubmitting(true);
      const res = await api<SubmitResponse>("/register/submit", {
        method: "POST",
        body: JSON.stringify({
          facility_id: facilityId,
          verified_rows: rows,
          image_reference: imageRef,
        }),
      });
      setSubmitResult(res);
      setRows([]);
      setPreviewUrl(null);
      setImageBase64(null);
    } catch (err: any) {
      alert(`Submit failed: ${err.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white text-slate-900 pb-16">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Phase 13 — Register Image Digitisation
              </p>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <ScanLine className="h-7 w-7 text-amber-400" />
              Medicine Register Digitisation
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload a scanned or photographed paper medicine register. AI extracts all stock data for human verification before saving.
            </p>
          </div>

          {submitResult && (
            <div className="mx-auto max-w-7xl mt-4">
              <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-3 text-sm text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                {submitResult.message}
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
          {/* Step 1: Image Upload */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 backdrop-blur space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-amber-400" />
              1. Upload Register Image or Use Sample
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Upload controls */}
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-xl p-8 text-center cursor-pointer transition-all"
                >
                  <Upload className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">
                    Click to upload register photo / scan
                  </p>
                  <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WebP — max 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-500 font-medium">OR</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>

                <button
                  onClick={handleUseSampleImage}
                  className="w-full px-4 py-3 rounded-xl border border-amber-700 bg-amber-950/40 hover:bg-amber-950/70 text-amber-300 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Use NHM Sample Register (Demo)
                </button>

                <button
                  onClick={handleExtract}
                  disabled={!previewUrl || loading}
                  className="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-slate-900 font-extrabold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Sparkles className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Extracting with Gemini Vision..." : "Extract Register Data"}
                </button>
              </div>

              {/* Right: Image Preview */}
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[240px] flex items-center justify-center">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Medicine register preview"
                    className="max-h-72 w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6">
                    <ScanLine className="h-12 w-12 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Register image preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Step 2: Editable Verification Table */}
          {rows.length > 0 && (
            <section className="rounded-2xl border border-amber-800 bg-white p-6 backdrop-blur space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-amber-400" />
                    2. Human Verification — Editable Register Draft
                  </h2>
                  {pageDescription && (
                    <p className="text-xs text-slate-500 mt-0.5">{pageDescription}</p>
                  )}
                  <p className="text-xs text-amber-300 font-medium mt-1">
                    ⚠️ AI extractions must be reviewed before saving to live inventory database.
                  </p>
                </div>
                {modelUsed && (
                  <span className="text-xs font-mono text-amber-300 bg-amber-950 px-3 py-1 rounded-md border border-amber-800 shrink-0">
                    Engine: {modelUsed}
                  </span>
                )}
              </div>

              {/* Scrollable Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900/80">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className={`text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${col.width}`}
                        >
                          {col.label}
                        </th>
                      ))}
                      <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[70px]">
                        Confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="px-2 py-2">
                            <input
                              type={col.type}
                              value={(row as any)[col.key] ?? ""}
                              onChange={(e) =>
                                handleRowChange(
                                  idx,
                                  col.key as keyof RegisterRowDraft,
                                  col.type === "number" ? parseInt(e.target.value) || 0 : e.target.value
                                )
                              }
                              className={`w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold ${col.color} focus:outline-hidden focus:border-amber-500`}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs font-bold font-mono ${
                              (row.confidence_score || 0) >= 0.9
                                ? "text-emerald-400"
                                : (row.confidence_score || 0) >= 0.8
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            {Math.round((row.confidence_score || 0) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  {rows.length} row(s) extracted — edit any field before saving.
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-slate-900 font-extrabold text-sm transition-all shadow-lg shadow-emerald-950 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {submitting ? "Reconciling Database..." : "Confirm & Save to Live Inventory"}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
