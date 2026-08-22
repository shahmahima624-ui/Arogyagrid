"use client";

import React, { useState } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Boxes,
  FileSpreadsheet,
  Edit3,
  Save,
  Volume2,
} from "lucide-react";

interface ExtractedItem {
  medicine_name: string;
  medicine_id?: string;
  remaining_stock: number;
  consumed_today: number;
  batch_number?: string;
  confidence_score: number;
  language_detected: string;
  notes?: string;
}

interface VoiceProcessResponse {
  drafts: ExtractedItem[];
  raw_transcript: string;
  model_used: string;
  extracted_at: string;
}

interface SubmitResponse {
  success: boolean;
  facility_name: string;
  items_updated: number;
  message: string;
}

export default function VoiceReportingPage() {
  const { user } = useAuth();
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [extractedDrafts, setExtractedDrafts] = useState<ExtractedItem[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);

  const presets = [
    {
      label: "Hindi/Hinglish Sample 1",
      text: "Paracetamol 500 mg ke 240 tablets bache hain. Aaj 37 use hue.",
    },
    {
      label: "English Sample 2",
      text: "500 vials of Insulin 100IU remaining, 25 consumed today.",
    },
    {
      label: "Hinglish Sample 3",
      text: "Amoxicillin 500mg ka 180 capsules stock me bacha hai, 12 today consumed.",
    },
  ];

  const handleSimulateRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    setIsRecording(true);
    // Use Web Speech API if supported, otherwise simulate speech input
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN";
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsRecording(false);
      };
      recognition.onerror = () => {
        setIsRecording(false);
      };
      recognition.start();
    } else {
      setTimeout(() => {
        setTranscript("Paracetamol 500 mg ke 240 tablets bache hain. Aaj 37 use hue.");
        setIsRecording(false);
      }, 2000);
    }
  };

  const handleProcessTranscript = async (textToProcess?: string) => {
    const text = textToProcess || transcript;
    if (!text.trim() || loading) return;

    try {
      setLoading(true);
      setSubmitResult(null);
      const res = await api<VoiceProcessResponse>("/voice/process-transcript", {
        method: "POST",
        body: JSON.stringify({ transcript: text }),
      });
      setExtractedDrafts(res.drafts);
      setModelUsed(res.model_used);
    } catch (err: any) {
      alert(`Voice extraction failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: keyof ExtractedItem, value: any) => {
    const updated = [...extractedDrafts];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedDrafts(updated);
  };

  const handleSubmitVerifiedReport = async () => {
    if (!user?.facility_id) {
      alert("Please ensure you are logged in as a facility user (or select a facility).");
    }
    const targetFacilityId = user?.facility_id || "11111111-1111-1111-1111-111111111111"; // Fallback to PHC Sanand

    try {
      setSubmitting(true);
      const res = await api<SubmitResponse>("/voice/submit-report", {
        method: "POST",
        body: JSON.stringify({
          facility_id: targetFacilityId,
          verified_items: extractedDrafts,
        }),
      });
      setSubmitResult(res);
      setExtractedDrafts([]);
      setTranscript("");
    } catch (err: any) {
      alert(`Submit failed: ${err.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-slate-900 text-slate-100 pb-16">
        {/* Header Banner */}
        <div className="border-b border-slate-800 bg-slate-950/60 backdrop-blur px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Phase 12 — Frontline Voice Inventory Reporting
                </p>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Mic className="h-7 w-7 text-emerald-400" />
                Voice Inventory Reporting
              </h1>
            </div>
          </div>

          {submitResult && (
            <div className="mx-auto max-w-7xl mt-4">
              <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-3 text-sm text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>
                  {submitResult.message} Live database inventory and consumption records reconciled!
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
          {/* Step 1: Voice Input Section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-800/40 p-6 backdrop-blur space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-emerald-400" />
                1. Speak or Enter Frontline Inventory Report
              </h2>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-700">
                Languages: Hindi • Hinglish • English
              </span>
            </div>

            {/* Mic Button & Controls */}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleSimulateRecording}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg ${
                  isRecording
                    ? "bg-rose-600 text-white animate-pulse shadow-rose-950"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950"
                }`}
              >
                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {isRecording ? "Listening Speech..." : "Tap to Speak"}
              </button>

              <div className="text-xs text-slate-400">
                Or choose a sample audio transcript preset:
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              {presets.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setTranscript(p.text);
                    handleProcessTranscript(p.text);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition-all text-left"
                >
                  <span className="text-emerald-400 font-bold mr-1">{p.label}:</span>
                  &quot;{p.text}&quot;
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div>
              <textarea
                rows={3}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Example: Paracetamol 500 mg ke 240 tablets bache hain. Aaj 37 use hue."
                className="w-full rounded-xl bg-slate-900 border border-slate-700 p-4 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <button
              onClick={() => handleProcessTranscript()}
              disabled={loading || !transcript.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-xs"
            >
              <Sparkles className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Extracting Draft..." : "Extract Inventory Draft"}
            </button>
          </section>

          {/* Step 2: Human Verification Editable Draft Form */}
          {extractedDrafts.length > 0 && (
            <section className="rounded-2xl border border-purple-800 bg-slate-800/60 p-6 backdrop-blur space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-purple-400" />
                    2. Human Verification & Editable Draft
                  </h2>
                  <p className="text-xs text-amber-300 font-medium mt-0.5">
                    ⚠️ AI extractions must be verified by staff before updating database inventory.
                  </p>
                </div>
                {modelUsed && (
                  <span className="text-xs font-mono text-purple-300 bg-purple-950 px-3 py-1 rounded-md border border-purple-800">
                    Engine: {modelUsed}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {extractedDrafts.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-700 bg-slate-900/80 grid grid-cols-1 md:grid-cols-4 gap-4 items-center"
                  >
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Medicine Name
                      </label>
                      <input
                        type="text"
                        value={item.medicine_name}
                        onChange={(e) => handleItemChange(idx, "medicine_name", e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Remaining Stock Qty
                      </label>
                      <input
                        type="number"
                        value={item.remaining_stock ?? 0}
                        onChange={(e) => handleItemChange(idx, "remaining_stock", parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Consumed Today Qty
                      </label>
                      <input
                        type="number"
                        value={item.consumed_today ?? 0}
                        onChange={(e) => handleItemChange(idx, "consumed_today", parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-purple-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        AI Confidence
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-300">
                          {Math.round((item.confidence_score || 0.9) * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {item.language_detected}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  onClick={handleSubmitVerifiedReport}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-950 flex items-center gap-2"
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
