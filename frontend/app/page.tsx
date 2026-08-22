"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ShieldAlert,
  Clock,
  Zap,
  Truck,
  Bot,
  Mic,
  ScanLine,
  MapPin,
  FileText,
  TrendingUp,
  Building2,
  Boxes,
  FileSpreadsheet,
  BarChart3,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const modules = [
  { href: "/dashboard", icon: Activity, label: "Command Centre", desc: "District KPIs & supply health overview" },
  { href: "/risks", icon: ShieldAlert, label: "Risk Engine", desc: "Days-to-stockout classification" },
  { href: "/expiry-rescue", icon: Clock, label: "Expiry Rescue", desc: "FEFO near-expiry surplus matching" },
  { href: "/redistribution", icon: Zap, label: "Redistribution", desc: "AI inter-facility transfer proposals" },
  { href: "/transfers", icon: Truck, label: "Transfers", desc: "Approval lifecycle management" },
  { href: "/forecasts", icon: TrendingUp, label: "Demand Forecasts", desc: "7d / 30d / 90d predictions" },
  { href: "/copilot", icon: Bot, label: "AI Copilot", desc: "Natural language supply assistant" },
  { href: "/voice-reporting", icon: Mic, label: "Voice Reporting", desc: "Hindi / Hinglish / English voice input" },
  { href: "/register-digitisation", icon: ScanLine, label: "Register Scan", desc: "Multimodal OCR on paper registers" },
  { href: "/map", icon: MapPin, label: "Geo Network Map", desc: "Live facility risk & transfer routes" },
  { href: "/stress-simulator", icon: Activity, label: "Stress Simulator", desc: "What-if demand surge simulation" },
  { href: "/reports", icon: FileText, label: "Reports", desc: "CSV exports & NHM dispatch manifests" },
  { href: "/facilities", icon: Building2, label: "Facilities", desc: "PHC / CHC / District Hospital network" },
  { href: "/inventory", icon: Boxes, label: "Inventory", desc: "Batch-level stock management" },
  { href: "/consumption", icon: FileSpreadsheet, label: "Consumption", desc: "Daily patient consumption records" },
  { href: "/consumption-intelligence", icon: BarChart3, label: "Insights", desc: "Moving averages & anomaly detection" },
];

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    fetch(`${apiBaseUrl}/health`)
      .then((r) => setApiStatus(r.ok ? "online" : "offline"))
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="font-black text-slate-900 tracking-tight">
              Aarogya<span className="text-emerald-600">Grid</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 text-xs font-medium ${
                apiStatus === "online"
                  ? "text-emerald-600"
                  : apiStatus === "offline"
                  ? "text-red-500"
                  : "text-slate-400"
              }`}
            >
              {apiStatus === "online" ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : apiStatus === "offline" ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin inline-block" />
              )}
              {apiStatus === "online" ? "API Online" : apiStatus === "offline" ? "API Offline" : "Connecting"}
            </span>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">
            National Health Mission — AI Supply Resilience Network
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight mb-4">
            Predict. Redistribute.<br />Prevent.
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mb-8">
            AarogyaGrid connects PHCs, CHCs, District Hospitals, and Warehouses to eliminate
            medicine stockouts using AI forecasting and intelligent redistribution.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
            >
              Open Command Centre <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm transition-colors"
            >
              <MapPin className="h-4 w-4 text-emerald-500" />
              View Network Map
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 mb-8" />

        {/* Modules grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
            All Modules
          </h2>
          <span className="text-xs text-slate-400">{modules.length} available</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group bg-white px-5 py-4 hover:bg-slate-50 transition-colors flex items-start gap-3"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-emerald-50 transition-colors">
                <m.icon className="h-4 w-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  {m.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Built for the <span className="font-semibold">National Health Mission (NHM)</span> · Powered by Gemini 2.5 · Supabase · Next.js 15
        </p>
      </main>
    </div>
  );
}
