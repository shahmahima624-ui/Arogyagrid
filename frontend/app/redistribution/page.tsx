"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "next/navigation";
import {
 ArrowRight,
 RefreshCw,
 Zap,
 Building2,
 MapPin,
 TrendingDown,
 ShieldCheck,
 Search,
 Filter,
 ChevronDown,
 ChevronUp,
 BarChart3,
 Boxes,
 Sparkles,
 X,
 Bot,
} from "lucide-react";

interface ScoreBreakdown {
 urgency_weight: number;
 surplus_weight: number;
 expiry_rescue_weight: number;
 impact_weight: number;
 distance_penalty: number;
 source_risk_penalty: number;
 final_score: number;
}

interface Recommendation {
 id: string;
 destination_facility_id: string;
 destination_facility_name: string;
 medicine_id: string;
 medicine_name: string;
 category: string;
 unit: string;
 status: string;
 recommended_quantity: number;
 source_facility_id?: string;
 source_facility_name?: string;
 source_facility_type?: string;
 source_warehouse_id?: string;
 source_warehouse_name?: string;
 distance_km?: number;
 destination_days_to_stockout?: number;
 source_safe_surplus?: number;
 estimated_coverage_days_restored?: number;
 reason: string;
 confidence: number;
 score: number;
 score_breakdown: ScoreBreakdown;
 created_at: string;
}

interface AIExplanation {
 recommendation_id: string;
 executive_summary: string;
 source_selection_rationale: string;
 operational_impact: string;
 risk_mitigation_plan: string;
 model_used: string;
 generated_at: string;
}

interface GenerateResponse {
 recommendations_created: number;
 scenarios_evaluated: number;
 message: string;
}

const STATUS_COLORS: Record<string, string> = {
 RECOMMENDED: "bg-white text-emerald-600 border-emerald-700",
 PENDING: "bg-white text-amber-600 border-amber-700",
 APPROVED: "bg-white text-blue-600 border-blue-700",
 REJECTED: "bg-white text-rose-600 border-rose-700",
 CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

function ScoreBar({ label, value, isPositive = true }: { label: string; value: number; isPositive?: boolean }) {
 const pct = Math.round(Math.abs(value) * 100);
 return (
 <div className="flex items-center gap-2 text-xs">
 <span className="w-32 text-slate-500 shrink-0">{label}</span>
 <div className="flex-1 bg-white rounded-full h-1.5 overflow-hidden">
 <div
 className={`h-1.5 rounded-full transition-all ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
 style={{ width: `${pct}%` }}
 />
 </div>
 <span className={`w-10 text-right font-mono font-semibold ${isPositive ? "+" : "-"}{pct}%`}>
 {isPositive ? "+" : "-"}{pct}%
 </span>
 </div>
 );
}

function AIExplanationModal({ explanation, onClose }: { explanation: AIExplanation; onClose: () => void }) {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/80 -md p-4">
 <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between border-b border-slate-200 pb-4">
 <div className="flex items-center gap-2 text-purple-600">
 <Sparkles className="h-5 w-5 text-purple-600" />
 <h3 className="text-lg font-bold text-slate-900">Gemini AI Executive Explanation</h3>
 </div>
 <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-white">
 <X className="h-5 w-5" />
 </button>
 </div>

 <div className="space-y-4 text-sm text-slate-700">
 <div className="bg-white p-4 rounded-xl border border-slate-200">
 <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Executive Summary</h4>
 <p className="leading-relaxed text-purple-100">{explanation.executive_summary}</p>
 </div>

 <div className="bg-white p-4 rounded-xl border border-slate-200">
 <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Source Selection Rationale</h4>
 <p className="leading-relaxed">{explanation.source_selection_rationale}</p>
 </div>

 <div className="bg-white p-4 rounded-xl border border-slate-200">
 <h4 className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">Clinical & Operational Impact</h4>
 <p className="leading-relaxed">{explanation.operational_impact}</p>
 </div>

 <div className="bg-white p-4 rounded-xl border border-slate-200">
 <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Risk Mitigation Plan</h4>
 <p className="leading-relaxed">{explanation.risk_mitigation_plan}</p>
 </div>
 </div>

 <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
 <span>Model: {explanation.model_used}</span>
 <span>Generated: {new Date(explanation.generated_at).toLocaleTimeString()}</span>
 </div>
 </div>
 </div>
 );
}

function RecommendationCard({
 rec,
 onInitiateTransfer,
 onExplainAI,
 explainingId,
}: {
 rec: Recommendation;
 onInitiateTransfer?: (id: string) => void;
 onExplainAI?: (id: string) => void;
 explainingId?: string | null;
}) {
 const [expanded, setExpanded] = useState(false);
 const srcName = rec.source_facility_name || rec.source_warehouse_name || "Network Source";
 const srcType = rec.source_facility_type || (rec.source_warehouse_name ? "Warehouse" : "");

 const confidencePct = Math.round(rec.confidence * 100);
 const urgencyColor =
 (rec.destination_days_to_stockout ?? 99) <= 3
 ? "border-slate-200 bg-white"
 : (rec.destination_days_to_stockout ?? 99) <= 7
 ? "border-slate-200 bg-white"
 : "border-slate-200 bg-slate-50";

 return (
 <div className={`rounded-2xl border ${urgencyColor} shadow-sm overflow-hidden transition-all`}>
 {/* Main Card Row */}
 <div className="p-5">
 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
 {/* Transfer Route */}
 <div className="flex items-center gap-3 flex-wrap">
 <div className="flex items-center gap-2">
 <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
 <div>
 <div className="font-bold text-slate-900 text-sm">{srcName}</div>
 <div className="text-[10px] text-slate-500 font-mono">{srcType}</div>
 </div>
 </div>
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200">
 <ArrowRight className="h-4 w-4 text-emerald-600" />
 <div className="text-sm font-black text-emerald-600">
 {rec.recommended_quantity.toLocaleString()} {rec.unit}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <TrendingDown className="h-4 w-4 text-rose-600 shrink-0" />
 <div>
 <div className="font-bold text-slate-900 text-sm">{rec.destination_facility_name}</div>
 <div className="text-[10px] text-rose-600 font-mono">
 {rec.destination_days_to_stockout !== undefined
 ? `⚡ ${rec.destination_days_to_stockout.toFixed(1)} days to stockout`
 : "At Risk"}
 </div>
 </div>
 </div>
 </div>

 {/* Score & Meta */}
 <div className="flex items-center gap-4 shrink-0 flex-wrap">
 {rec.distance_km && (
 <div className="text-center">
 <div className="text-xs text-slate-500">Distance</div>
 <div className="text-sm font-bold text-slate-700 font-mono">
 <MapPin className="h-3 w-3 inline text-emerald-600 mr-0.5" />
 {rec.distance_km.toFixed(1)} km
 </div>
 </div>
 )}
 <div className="text-center">
 <div className="text-xs text-slate-500">Coverage Restored</div>
 <div className="text-sm font-bold text-emerald-600 font-mono">
 ~{rec.estimated_coverage_days_restored?.toFixed(0) ?? "?"}d
 </div>
 </div>
 <div className="text-center">
 <div className="text-xs text-slate-500">Score</div>
 <div className="text-xl font-black text-slate-900 font-mono">
 {rec.score.toFixed(2)}
 </div>
 </div>

 <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS_COLORS[rec.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
 {rec.status}
 </span>

 {onExplainAI && (
 <button
 onClick={() => onExplainAI(rec.id)}
 disabled={explainingId === rec.id}
 className="px-3 py-1.5 rounded-xl bg-white hover:bg-white border border-purple-600 text-xs font-bold text-purple-200 transition-all flex items-center gap-1.5 shadow-xs"
 >
 <Sparkles className={`h-3.5 w-3.5 text-purple-600 ${explainingId === rec.id ? "animate-spin" : ""}`} />
 {explainingId === rec.id ? "Explaining..." : "Gemini AI"}
 </button>
 )}

 {rec.status === "RECOMMENDED" && onInitiateTransfer && (
 <button
 onClick={() => onInitiateTransfer(rec.id)}
 className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-slate-900 transition-all shadow-xs flex items-center gap-1"
 >
 Initiate Transfer →
 </button>
 )}

 <button
 onClick={() => setExpanded(!expanded)}
 className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-500"
 >
 {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
 </button>
 </div>
 </div>

 {/* Medicine & Category */}
 <div className="mt-3 flex items-center gap-3 flex-wrap">
 <span className="text-xs font-mono text-purple-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
 {rec.medicine_name}
 </span>
 <span className="text-xs text-slate-500">{rec.category}</span>
 {rec.source_safe_surplus && (
 <span className="text-xs text-emerald-600">
 Source surplus: {rec.source_safe_surplus.toLocaleString()} {rec.unit}
 </span>
 )}
 </div>
 </div>

 {/* Expanded: Score Breakdown & Reason */}
 {expanded && (
 <div className="border-t border-slate-200 p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white">
 <div>
 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
 <BarChart3 className="h-3.5 w-3.5" />
 Transparent Score Breakdown
 </h4>
 <div className="space-y-2">
 <ScoreBar label="Urgency Weight" value={rec.score_breakdown.urgency_weight} isPositive={true} />
 <ScoreBar label="Surplus Weight" value={rec.score_breakdown.surplus_weight} isPositive={true} />
 <ScoreBar label="Expiry Rescue" value={rec.score_breakdown.expiry_rescue_weight} isPositive={true} />
 <ScoreBar label="Impact Weight" value={rec.score_breakdown.impact_weight} isPositive={true} />
 <ScoreBar label="Distance Penalty" value={rec.score_breakdown.distance_penalty} isPositive={false} />
 <ScoreBar label="Source Risk Penalty" value={rec.score_breakdown.source_risk_penalty} isPositive={false} />
 <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between text-xs">
 <span className="text-slate-500 font-semibold">Final Score</span>
 <span className="font-black text-slate-900 font-mono text-base">{rec.score_breakdown.final_score.toFixed(3)}</span>
 </div>
 </div>
 </div>

 <div>
 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
 <ShieldCheck className="h-3.5 w-3.5" />
 Engine Rationale
 </h4>
 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
 {rec.reason}
 </p>
 </div>
 </div>
 )}
 </div>
 );
}

export default function RedistributionPage() {
 const { user } = useAuth();
 const router = useRouter();
 const [recs, setRecs] = useState<Recommendation[]>([]);
 const [loading, setLoading] = useState(true);
 const [generating, setGenerating] = useState(false);
 const [lastGenResult, setLastGenResult] = useState<GenerateResponse | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState("ALL");
 const [aiModalData, setAiModalData] = useState<AIExplanation | null>(null);
 const [explainingId, setExplainingId] = useState<string | null>(null);

 const isAdmin = user?.role === "DISTRICT_ADMIN" || user?.role === "WAREHOUSE_MANAGER";

 const loadRecs = useCallback(async () => {
 try {
 setLoading(true);
 const params = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
 const data = await api<Recommendation[]>(`/redistribution/recommendations${params}`);
 setRecs(data);
 } catch {
 setRecs([]);
 } finally {
 setLoading(false);
 }
 }, [statusFilter]);

 useEffect(() => {
 loadRecs();
 }, [loadRecs]);

 const handleGenerate = async () => {
 try {
 setGenerating(true);
 const result = await api<GenerateResponse>("/redistribution/generate", {
 method: "POST",
 body: JSON.stringify({ top_n_per_shortage: 3 }),
 });
 setLastGenResult(result);
 await loadRecs();
 } catch (e) {
 console.error("Generate failed:", e);
 } finally {
 setGenerating(false);
 }
 };

 const handleInitiateTransfer = async (recId: string) => {
 try {
 await api(`/transfers/from-recommendation/${recId}`, { method: "POST" });
 router.push("/transfers");
 } catch (err: any) {
 alert(`Failed to initiate transfer: ${err.message || "Unknown error"}`);
 }
 };

 const handleExplainAI = async (recId: string) => {
 try {
 setExplainingId(recId);
 const explanation = await api<AIExplanation>(`/ai/explain-redistribution/${recId}`, {
 method: "POST",
 });
 setAiModalData(explanation);
 } catch (err: any) {
 alert(`Failed to fetch AI explanation: ${err.message || "Unknown error"}`);
 } finally {
 setExplainingId(null);
 }
 };

 const filteredRecs = recs.filter((r) => {
 const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
 const q = searchQuery.toLowerCase();
 const matchesSearch =
 !q ||
 r.medicine_name.toLowerCase().includes(q) ||
 r.destination_facility_name.toLowerCase().includes(q) ||
 (r.source_facility_name || "").toLowerCase().includes(q) ||
 (r.source_warehouse_name || "").toLowerCase().includes(q);
 return matchesStatus && matchesSearch;
 });

 const statuses = ["ALL", "RECOMMENDED", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

 const criticalCount = recs.filter((r) => (r.destination_days_to_stockout ?? 99) <= 3).length;
 const totalUnits = recs.reduce((s, r) => s + r.recommended_quantity, 0);
 const avgScore = recs.length > 0 ? recs.reduce((s, r) => s + r.score, 0) / recs.length : 0;

 return (
 <>
 <Nav />
 <main className="min-h-screen bg-white text-slate-900 pb-16">
 {/* Banner */}
 <div className="border-b border-slate-200 bg-white/95 px-4 sm:px-6 lg:px-8 py-6">
 <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <div className="flex items-center gap-2">
 <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
 <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
 Gemini AI Redistribution & Explanation
 </p>
 </div>
 <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
 <Zap className="h-7 w-7 text-emerald-600" />
 Redistribution Engine & AI Explainer
 </h1>
 </div>

 {isAdmin && (
 <button
 onClick={handleGenerate}
 disabled={generating}
 className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-slate-900 transition-all shadow-lg shadow-emerald-900/30 self-start md:self-auto"
 >
 <Zap className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
 {generating ? "Analysing Network..." : "Generate Recommendations"}
 </button>
 )}
 </div>
 </div>

 <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
 {/* KPI Row */}
 <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
 <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
 <div className="text-xs text-slate-500">Total Recommendations</div>
 <div className="text-3xl font-black text-slate-900 mt-1">{loading ? "..." : recs.length}</div>
 </div>
 <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
 <div className="text-xs font-bold text-rose-600">Critical (≤3d stockout)</div>
 <div className="text-3xl font-black text-rose-600 mt-1">{loading ? "..." : criticalCount}</div>
 </div>
 <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
 <div className="text-xs font-bold text-emerald-600">Total Units to Redistribute</div>
 <div className="text-3xl font-black text-emerald-600 mt-1">{loading ? "..." : totalUnits.toLocaleString()}</div>
 </div>
 <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
 <div className="text-xs font-bold text-purple-600">Gemini AI Explainer</div>
 <div className="text-sm font-bold text-purple-200 mt-2 flex items-center gap-1.5">
 <Sparkles className="h-4 w-4 text-purple-600" /> Active & Online
 </div>
 </div>
 </section>

 {/* Filters */}
 <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search medicine, facility, warehouse..."
 className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
 />
 </div>
 <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto">
 {statuses.map((s) => (
 <button
 key={s}
 onClick={() => setStatusFilter(s)}
 className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
 statusFilter === s ? "bg-emerald-600 text-slate-900" : "text-slate-500 hover:text-slate-700"
 }`}
 >
 {s === "ALL" ? "All Statuses" : s}
 </button>
 ))}
 </div>
 </div>

 {/* List */}
 {loading ? (
 <div className="text-center text-slate-500 py-12">Loading redistribution recommendations...</div>
 ) : filteredRecs.length === 0 ? (
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-slate-500">
 No recommendations found.
 </div>
 ) : (
 <div className="space-y-4">
 {filteredRecs.map((rec) => (
 <RecommendationCard
 key={rec.id}
 rec={rec}
 onInitiateTransfer={handleInitiateTransfer}
 onExplainAI={handleExplainAI}
 explainingId={explainingId}
 />
 ))}
 </div>
 )}
 </div>
 </main>

 {/* AI Explanation Modal */}
 {aiModalData && (
 <AIExplanationModal explanation={aiModalData} onClose={() => setAiModalData(null)} />
 )}
 </>
 );
}
