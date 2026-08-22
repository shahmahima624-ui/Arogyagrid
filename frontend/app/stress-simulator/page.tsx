"use client";

import React, { useState, useEffect } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import {
 Activity,
 Flame,
 Truck,
 TrendingUp,
 AlertTriangle,
 ShieldAlert,
 ArrowRight,
 RefreshCw,
 Sliders,
 Sparkles,
 Zap,
 Building2,
 Boxes,
 CheckCircle2,
} from "lucide-react";

interface Scenario {
 scenario_type: string;
 medicine_category?: string;
 medicine_name_filter?: string;
 demand_increase_percentage: number;
 supply_delay_days: number;
}

interface Impact {
 facility_id: string;
 facility_name: string;
 facility_type: string;
 medicine_id: string;
 medicine_name: string;
 current_stock: number;
 baseline_daily_demand: number;
 simulated_daily_demand: number;
 baseline_days_to_stockout: number;
 simulated_days_to_stockout: number;
 stockout_date_baseline: string;
 stockout_date_simulated: string;
 days_stockout_accelerated: number;
 emergency_stock_required: number;
 risk_level: string;
}

interface TransferProposal {
 source_facility_id: string;
 source_facility_name: string;
 destination_facility_id: string;
 destination_facility_name: string;
 medicine_name: string;
 recommended_transfer_qty: number;
 prevents_stockout: boolean;
}

interface SimulationResult {
 scenario: Scenario;
 executed_at: string;
 summary: {
 total_facilities_affected: number;
 facilities_newly_critical: number;
 total_emergency_stock_needed: number;
 avg_days_stockout_accelerated: number;
 };
 facility_impacts: Impact[];
 preventive_transfers: TransferProposal[];
 chart_data: Array<{
 day: string;
 baseline_stock: number;
 simulated_stock: number;
 gap: number;
 }>;
}

export default function StressSimulatorPage() {
 const [demandSurge, setDemandSurge] = useState(30);
 const [supplyDelay, setSupplyDelay] = useState(0);
 const [selectedMed, setSelectedMed] = useState("All");

 const [loading, setLoading] = useState(false);
 const [result, setResult] = useState<SimulationResult | null>(null);

 const presets = [
 {
 label: "Dengue Outbreak (+50% Paracetamol)",
 type: "EPIDEMIC_OUTBREAK",
 medFilter: "Paracetamol",
 surge: 50,
 delay: 0,
 icon: Flame,
 },
 {
 label: "Summer Heatwave (+50% ORS)",
 type: "HEATWAVE_SURGE",
 medFilter: "ORS",
 surge: 50,
 delay: 0,
 icon: TrendingUp,
 },
 {
 label: "Supply Chain Delay (+14 Days)",
 type: "SUPPLY_DELAY",
 medFilter: "",
 surge: 0,
 delay: 14,
 icon: Truck,
 },
 {
 label: "Monsoon Surge (+40% Antibiotics)",
 type: "DEMAND_SURGE",
 medFilter: "Amoxicillin",
 surge: 40,
 delay: 3,
 icon: Zap,
 },
 ];

 const runSimulation = async (
 surgeVal = demandSurge,
 delayVal = supplyDelay,
 medVal = selectedMed
 ) => {
 try {
 setLoading(true);
 const res = await api<SimulationResult>("/simulations/run", {
 method: "POST",
 body: JSON.stringify({
 scenario_type: "CUSTOM",
 medicine_name_filter: medVal !== "All" ? medVal : null,
 demand_increase_percentage: surgeVal,
 supply_delay_days: delayVal,
 }),
 });
 setResult(res);
 } catch (err: any) {
 alert(`Simulation failed: ${err.message || "Unknown error"}`);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 runSimulation(30, 0, "All");
 }, []);

 const handleApplyPreset = (p: typeof presets[0]) => {
 setDemandSurge(p.surge);
 setSupplyDelay(p.delay);
 setSelectedMed(p.medFilter || "All");
 runSimulation(p.surge, p.delay, p.medFilter || "All");
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
 <span className="flex h-2.5 w-2.5 rounded-full bg-rose-400 animate-ping" />
 <p className="text-xs font-bold uppercase tracking-widest text-rose-600">
 Health Supply Stress & Surge Simulator
 </p>
 </div>
 <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
 <Activity className="h-7 w-7 text-rose-600" />
 What-If Stress Simulator
 </h1>
 <p className="mt-1 text-sm text-slate-500">
 Simulate demand spikes (heatwaves, disease outbreaks) & supply delays to project stockout dates and emergency buffer needs.
 </p>
 </div>

 <button
 onClick={() => runSimulation()}
 disabled={loading}
 className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-slate-900 font-extrabold text-sm transition-all shadow-lg shadow-rose-950 flex items-center gap-2"
 >
 <Sparkles className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
 {loading ? "Simulating..." : "Run Simulation"}
 </button>
 </div>
 </div>

 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
 {/* Preset Buttons */}
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
 <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
 <Zap className="h-3.5 w-3.5 text-rose-600" />
 Quick Preset Scenarios
 </div>
 <div className="flex flex-wrap gap-3">
 {presets.map((p, idx) => {
 const Icon = p.icon;
 return (
 <button
 key={idx}
 onClick={() => handleApplyPreset(p)}
 className="px-4 py-2.5 rounded-xl bg-white hover:bg-white border border-slate-200 hover:border-rose-600 text-xs font-bold text-slate-700 transition-all flex items-center gap-2"
 >
 <Icon className="h-4 w-4 text-rose-600" />
 {p.label}
 </button>
 );
 })}
 </div>
 </div>

 {/* Interactive Controls Sliders */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-2xl border border-slate-200 bg-white p-6 ">
 <div>
 <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
 <span>Demand Surge %</span>
 <span className="text-rose-600 font-mono text-sm">+{demandSurge}%</span>
 </div>
 <input
 type="range"
 min="-20"
 max="150"
 step="5"
 value={demandSurge}
 onChange={(e) => setDemandSurge(parseInt(e.target.value))}
 className="w-full accent-rose-500 cursor-pointer"
 />
 <span className="text-[11px] text-slate-500">e.g. +30% ORS surge during heatwave</span>
 </div>

 <div>
 <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
 <span>Supply Chain Delay</span>
 <span className="text-amber-600 font-mono text-sm">+{supplyDelay} Days</span>
 </div>
 <input
 type="range"
 min="0"
 max="30"
 step="1"
 value={supplyDelay}
 onChange={(e) => setSupplyDelay(parseInt(e.target.value))}
 className="w-full accent-amber-500 cursor-pointer"
 />
 <span className="text-[11px] text-slate-500">e.g. +14 days shipment delay</span>
 </div>

 <div>
 <label className="block text-xs font-bold text-slate-600 mb-2">
 Filter Medicine
 </label>
 <select
 value={selectedMed}
 onChange={(e) => setSelectedMed(e.target.value)}
 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold"
 >
 <option value="All">All Essential Medicines</option>
 <option value="ORS">ORS Powder</option>
 <option value="Paracetamol">Paracetamol 500mg</option>
 <option value="Amoxicillin">Amoxicillin 500mg</option>
 <option value="Insulin">Insulin 100IU</option>
 </select>
 </div>
 </div>

 {/* KPI Summary Cards */}
 {result && (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 ">
 <div className="text-xs font-medium text-slate-500">Total Facilities Analyzed</div>
 <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
 {result.summary.total_facilities_affected}
 </div>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-white p-5 ">
 <div className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
 <ShieldAlert className="h-4 w-4 text-rose-600" />
 Newly Critical Facilities
 </div>
 <div className="text-2xl font-extrabold text-rose-200 mt-1 font-mono">
 {result.summary.facilities_newly_critical}
 </div>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-white p-5 ">
 <div className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
 <Boxes className="h-4 w-4 text-amber-600" />
 Emergency Stock Buffer
 </div>
 <div className="text-2xl font-extrabold text-amber-200 mt-1 font-mono">
 {result.summary.total_emergency_stock_needed.toLocaleString()} units
 </div>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-white p-5 ">
 <div className="text-xs font-bold text-purple-600 flex items-center gap-1.5">
 <TrendingUp className="h-4 w-4 text-purple-600" />
 Avg Stockout Acceleration
 </div>
 <div className="text-2xl font-extrabold text-purple-200 mt-1 font-mono">
 {result.summary.avg_days_stockout_accelerated} days earlier
 </div>
 </div>
 </div>
 )}

 {/* 30-Day Aggregate Stock Level Trajectory Progress Bars */}
 {result && result.chart_data && (
 <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
 <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
 <Activity className="h-5 w-5 text-rose-600" />
 30-Day Projected District Stock Trajectory (Baseline vs Simulated Surge)
 </h2>

 <div className="space-y-3 pt-2">
 {result.chart_data.map((c, i) => (
 <div key={i} className="space-y-1">
 <div className="flex justify-between text-xs font-mono font-bold text-slate-600">
 <span>{c.day}</span>
 <span>
 Baseline: <span className="text-emerald-600">{c.baseline_stock}</span> | Simulated:{" "}
 <span className="text-rose-600">{c.simulated_stock}</span> (Gap: {c.gap})
 </span>
 </div>
 <div className="h-3 w-full bg-white rounded-full overflow-hidden flex">
 <div
 style={{ width: `${Math.min(100, (c.simulated_stock / (c.baseline_stock || 1)) * 100)}%` }}
 className="bg-rose-500 h-full transition-all"
 />
 <div
 style={{
 width: `${Math.max(0, 100 - (c.simulated_stock / (c.baseline_stock || 1)) * 100)}%`,
 }}
 className="bg-slate-200 h-full"
 />
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* Preventive Transfers Recommendation Section */}
 {result && result.preventive_transfers.length > 0 && (
 <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
 <h2 className="text-base font-bold text-emerald-600 flex items-center gap-2">
 <CheckCircle2 className="h-5 w-5 text-emerald-600" />
 Suggested Preventive Transfers to Counter Simulated Surge
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {result.preventive_transfers.map((t, idx) => (
 <div
 key={idx}
 className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 text-xs"
 >
 <div>
 <div className="font-bold text-slate-900 text-sm mb-1">{t.medicine_name}</div>
 <div className="text-slate-500">
 From: <span className="text-slate-700 font-bold">{t.source_facility_name}</span>
 </div>
 <div className="text-slate-500">
 To: <span className="text-emerald-600 font-bold">{t.destination_facility_name}</span>
 </div>
 </div>
 <div className="text-right">
 <span className="px-3 py-1 rounded-lg bg-white text-emerald-200 font-mono font-extrabold text-sm block">
 +{t.recommended_transfer_qty} units
 </span>
 <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
 ✓ Prevents Simulated Stockout
 </span>
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* Impacted Facilities Before vs After Table */}
 {result && (
 <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
 <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
 <Building2 className="h-5 w-5 text-rose-600" />
 Facility Impact & Accelerated Stockout Comparison Table
 </h2>

 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <table className="w-full text-xs text-left">
 <thead>
 <tr className="bg-white text-slate-500 uppercase tracking-wider font-bold">
 <th className="px-4 py-3">Facility</th>
 <th className="px-4 py-3">Medicine</th>
 <th className="px-4 py-3">Stock</th>
 <th className="px-4 py-3">Baseline Demand</th>
 <th className="px-4 py-3">Simulated Demand</th>
 <th className="px-4 py-3">Baseline Stockout</th>
 <th className="px-4 py-3">Simulated Stockout</th>
 <th className="px-4 py-3">Accelerated</th>
 <th className="px-4 py-3">Emergency Buffer</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800">
 {result.facility_impacts.map((imp, idx) => (
 <tr key={idx} className="hover:bg-white transition-colors">
 <td className="px-4 py-3 font-bold text-slate-900">
 {imp.facility_name}
 <span className="block text-[10px] text-slate-500 font-normal">
 {imp.facility_type}
 </span>
 </td>
 <td className="px-4 py-3 font-bold text-slate-600">{imp.medicine_name}</td>
 <td className="px-4 py-3 font-mono font-bold text-slate-700">
 {imp.current_stock}
 </td>
 <td className="px-4 py-3 font-mono text-slate-500">
 {imp.baseline_daily_demand}/day
 </td>
 <td className="px-4 py-3 font-mono text-rose-600 font-bold">
 {imp.simulated_daily_demand}/day
 </td>
 <td className="px-4 py-3 font-mono text-slate-500">
 {imp.stockout_date_baseline} ({imp.baseline_days_to_stockout}d)
 </td>
 <td className="px-4 py-3 font-mono font-bold text-rose-600">
 {imp.stockout_date_simulated} ({imp.simulated_days_to_stockout}d)
 </td>
 <td className="px-4 py-3">
 <span
 className={`px-2 py-0.5 rounded-md font-mono font-bold ${
 imp.days_stockout_accelerated > 5
 ? "bg-white text-rose-600 border border-slate-200"
 : imp.days_stockout_accelerated > 0
 ? "bg-white text-amber-600 border border-slate-200"
 : "bg-slate-100 text-slate-500"
 }`}
 >
 {imp.days_stockout_accelerated > 0
 ? `-${imp.days_stockout_accelerated} days`
 : "0 days"}
 </span>
 </td>
 <td className="px-4 py-3 font-mono font-bold text-amber-600">
 +{imp.emergency_stock_required} units
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>
 )}
 </div>
 </main>
 </>
 );
}
