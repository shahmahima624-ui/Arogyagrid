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
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Radio,
  Layers,
  ChevronRight,
  TrendingDown,
  ExternalLink,
} from "lucide-react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const corePillars = [
  {
    icon: TrendingUp,
    title: "Multi-Horizon AI Forecasting",
    desc: "7-day, 30-day, and 90-day demand forecasts using trend models and patient consumption patterns to predict shortages before they happen.",
    color: "bg-teal-50 text-teal-700 border-teal-200",
    iconBg: "bg-teal-600 text-white",
  },
  {
    icon: Clock,
    title: "FEFO Expiry Rescue Engine",
    desc: "First-Expiry-First-Out algorithm automatically pairs near-expiry surplus medicine batches with high-demand shortage facilities.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    iconBg: "bg-amber-600 text-white",
  },
  {
    icon: Zap,
    title: "Geodesic Stock Redistribution",
    desc: "Haversine distance matrix and multi-factor scoring transparently rank the optimal transfer routes between PHCs, CHCs, and Warehouses.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconBg: "bg-blue-600 text-white",
  },
  {
    icon: ScanLine,
    title: "Multimodal OCR & Voice Entry",
    desc: "Frontline health workers capture paper stock registers with photos (Gemini Vision) or report stock using Hindi/Hinglish voice audio.",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    iconBg: "bg-purple-600 text-white",
  },
];

const impactStats = [
  { value: "0%", label: "Preventable Stockouts", desc: "Real-time automated alerts" },
  { value: "90d", label: "Expiry Rescue Window", desc: "FEFO surplus allocation" },
  { value: "21", label: "Operational AI Modules", desc: "Full-stack integration" },
  { value: "100%", label: "Human-in-the-Loop", desc: "Verified approval lifecycle" },
];

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [activeTab, setActiveTab] = useState<"forecast" | "rescue" | "redistribution">("forecast");

  useEffect(() => {
    fetch(`${apiBaseUrl}/health`)
      .then((r) => setApiStatus(r.ok ? "online" : "offline"))
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Aarogya<span className="text-teal-600">Grid</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                National Health Mission
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span
              className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                apiStatus === "online"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : apiStatus === "offline"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  apiStatus === "online"
                    ? "bg-emerald-500 animate-pulse"
                    : apiStatus === "offline"
                    ? "bg-rose-500"
                    : "bg-slate-400 animate-pulse"
                }`}
              />
              {apiStatus === "online" ? "Grid System Online" : apiStatus === "offline" ? "API Standby" : "Checking System"}
            </span>

            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              Command Centre
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold mb-6">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            AI-Powered Medicine Supply Resilience Network
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] max-w-5xl mx-auto mb-6">
            Predict. Redistribute. <br />
            <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 bg-clip-text text-transparent">
              Prevent Stockouts.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            AarogyaGrid connects Primary Health Centres (PHCs), Community Health Centres (CHCs), District Hospitals, and Warehouses across India — preventing stockouts and saving near-expiry medicines.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Launch Operational Dashboard
            </Link>
            <Link
              href="/map"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-sm font-extrabold transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <MapPin className="h-4 w-4 text-teal-600" />
              View Geo Network Map
            </Link>
          </div>

          {/* Interactive Live Dashboard Preview Box */}
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-left">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-600">
                  Live Operations Preview
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Ahmedabad District Healthcare Network
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("forecast")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "forecast" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Demand Forecast
                </button>
                <button
                  onClick={() => setActiveTab("rescue")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "rescue" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Expiry Rescue
                </button>
                <button
                  onClick={() => setActiveTab("redistribution")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "redistribution" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Stock Transfer
                </button>
              </div>
            </div>

            {/* Dynamic Card Content based on Active Tab */}
            {activeTab === "forecast" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                    <span>PHC Sanand</span>
                    <span className="text-teal-700 font-bold">Amoxicillin 500mg</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">450 units</div>
                  <p className="text-xs text-slate-500 mt-1">Predicted 30-day demand: <strong>600 units</strong></p>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                    <span>⚠️ Stockout Risk in 7 Days</span>
                    <span>DTS: 7.5d</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                    <span>PHC Bavla</span>
                    <span className="text-teal-700 font-bold">Paracetamol 500mg</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">2,400 units</div>
                  <p className="text-xs text-slate-500 mt-1">Predicted 30-day demand: <strong>1,100 units</strong></p>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-teal-700 bg-teal-50 p-2 rounded border border-teal-200">
                    <span>✓ Surplus Stock Available</span>
                    <span>+1,300 Buffer</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                    <span>CHC Viramgam</span>
                    <span className="text-teal-700 font-bold">ORS Sachet</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">1,850 units</div>
                  <p className="text-xs text-slate-500 mt-1">Predicted 30-day demand: <strong>1,800 units</strong></p>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                    <span>✓ Adequate Stock Level</span>
                    <span>Safe Window</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "rescue" && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="font-bold text-slate-900 text-sm">FEFO Expiry Rescue Candidate Detected</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Expiring in 42 Days
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Medicine & Batch</span>
                    <strong className="text-slate-900 font-bold">Metformin 500mg (#BATCH-902)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Source Surplus Node</span>
                    <strong className="text-slate-900 font-bold">PHC Rampura (+800 excess units)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Target High-Demand Node</span>
                    <strong className="text-teal-700 font-bold">PHC Sanand (High patient consumption)</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "redistribution" && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-slate-900 text-sm">AI Inter-Facility Transfer Proposal</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                    Match Score: 94%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Distance Route</span>
                    <strong className="text-slate-900 font-bold">14.2 km (Haversine Geodesic)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Recommended Quantity</span>
                    <strong className="text-slate-900 font-bold">400 Tablets</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Transfer Status</span>
                    <strong className="text-amber-700 font-bold">PENDING HUMAN APPROVAL</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Impact Stats Ribbon */}
      <section className="bg-white border-y border-slate-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {impactStats.map((stat) => (
              <div key={stat.label} className="p-4">
                <div className="text-4xl sm:text-5xl font-black text-teal-600 mb-1">{stat.value}</div>
                <div className="text-sm font-bold text-slate-900">{stat.label}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Pillars Section */}
      <section className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-widest text-teal-600">
              Platform Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2">
              Built for Public Health Resilience
            </h2>
            <p className="text-slate-600 text-base mt-3">
              Comprehensive tools designed specifically for District Medical Officers, PHC Medical Officers, and Warehouse Managers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {corePillars.map((pillar) => (
              <div
                key={pillar.title}
                className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${pillar.iconBg} mb-6`}>
                    <pillar.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{pillar.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">{pillar.desc}</p>
                </div>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900"
                >
                  Explore in Dashboard <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="bg-teal-700 text-white py-16 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Guarantee Medicine Supply Resilience Today
          </h2>
          <p className="text-teal-100 text-base mb-8 max-w-2xl mx-auto">
            Experience the National Health Mission District Health Operations Platform in action.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-slate-100 text-teal-900 text-sm font-extrabold transition-all shadow-lg"
          >
            Open Command Centre
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-400" />
            <span className="font-bold text-white">AarogyaGrid</span>
            <span>· National Health Mission Platform</span>
          </div>
          <p>Powered by Google Gemini 2.5 · Supabase · Next.js 15 · FastAPI</p>
        </div>
      </footer>
    </div>
  );
}
