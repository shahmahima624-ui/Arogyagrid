"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Nav } from "../../components/nav";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
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

interface GenerateResponse {
  recommendations_created: number;
  scenarios_evaluated: number;
  message: string;
}

const STATUS_COLORS: Record<string, string> = {
  RECOMMENDED: "bg-emerald-950/60 text-emerald-300 border-emerald-700",
  PENDING: "bg-amber-950/60 text-amber-300 border-amber-700",
  APPROVED: "bg-blue-950/60 text-blue-300 border-blue-700",
  REJECTED: "bg-rose-950/60 text-rose-300 border-rose-700",
  CANCELLED: "bg-slate-800 text-slate-400 border-slate-700",
};

function ScoreBar({ label, value, isPositive = true }: { label: string; value: number; isPositive?: boolean }) {
  const pct = Math.round(Math.abs(value) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-10 text-right font-mono font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
        {isPositive ? "+" : "-"}{pct}%
      </span>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const srcName = rec.source_facility_name || rec.source_warehouse_name || "Network Source";
  const srcType = rec.source_facility_type || (rec.source_warehouse_name ? "Warehouse" : "");

  const confidencePct = Math.round(rec.confidence * 100);
  const urgencyColor =
    (rec.destination_days_to_stockout ?? 99) <= 3
      ? "border-rose-800 bg-rose-950/20"
      : (rec.destination_days_to_stockout ?? 99) <= 7
      ? "border-amber-800 bg-amber-950/20"
      : "border-slate-800 bg-slate-800/40";

  return (
    <div className={`rounded-2xl border ${urgencyColor} backdrop-blur shadow-sm overflow-hidden transition-all`}>
      {/* Main Card Row */}
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Transfer Route */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-white text-sm">{srcName}</div>
                <div className="text-[10px] text-slate-400 font-mono">{srcType}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800">
              <ArrowRight className="h-4 w-4 text-emerald-400" />
              <div className="text-sm font-black text-emerald-300">
                {rec.recommended_quantity.toLocaleString()} {rec.unit}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />
              <div>
                <div className="font-bold text-white text-sm">{rec.destination_facility_name}</div>
                <div className="text-[10px] text-rose-300 font-mono">
                  {rec.destination_days_to_stockout !== undefined
                    ? `⚡ ${rec.destination_days_to_stockout.toFixed(1)} days to stockout`
                    : "At Risk"}
                </div>
              </div>
            </div>
          </div>

          {/* Score & Meta */}
          <div className="flex items-center gap-4 shrink-0">
            {rec.distance_km && (
              <div className="text-center">
                <div className="text-xs text-slate-400">Distance</div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  <MapPin className="h-3 w-3 inline text-emerald-400 mr-0.5" />
                  {rec.distance_km.toFixed(1)} km
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xs text-slate-400">Coverage Restored</div>
              <div className="text-sm font-bold text-emerald-300 font-mono">
                ~{rec.estimated_coverage_days_restored?.toFixed(0) ?? "?"}d
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400">Score</div>
              <div className="text-xl font-black text-white font-mono">
                {rec.score.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400">Confidence</div>
              <div
                className={`text-sm font-bold font-mono ${
                  confidencePct >= 70 ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {confidencePct}%
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS_COLORS[rec.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
              {rec.status}
            </span>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Medicine & Category */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-800 px-2 py-0.5 rounded">
            {rec.medicine_name}
          </span>
          <span className="text-xs text-slate-400">{rec.category}</span>
          {rec.source_safe_surplus && (
            <span className="text-xs text-emerald-300">
              Source surplus: {rec.source_safe_surplus.toLocaleString()} {rec.unit}
            </span>
          )}
        </div>
      </div>

      {/* Expanded: Score Breakdown & Reason */}
      {expanded && (
        <div className="border-t border-slate-700/60 p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/40">
          {/* Score Breakdown */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
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
              <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Final Score</span>
                <span className="font-black text-white font-mono text-base">{rec.score_breakdown.final_score.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Engine Rationale
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              {rec.reason}
            </p>
            <div className="mt-3 text-[11px] text-slate-500 font-mono">
              Generated: {new Date(rec.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RedistributionPage() {
  const { user } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastGenResult, setLastGenResult] = useState<GenerateResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
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

  // Summary KPIs
  const criticalCount = recs.filter(r => (r.destination_days_to_stockout ?? 99) <= 3).length;
  const totalUnits = recs.reduce((s, r) => s + r.recommended_quantity, 0);
  const avgScore = recs.length > 0 ? recs.reduce((s, r) => s + r.score, 0) / recs.length : 0;

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
                  Phase 8 — AI-Driven Network Redistribution
                </p>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">Human Approval Required Before Stock Changes</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Zap className="h-7 w-7 text-emerald-400" />
                Redistribution Engine
              </h1>
            </div>

            {isAdmin && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-lg shadow-emerald-900/30 self-start md:self-auto"
              >
                <Zap className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
                {generating ? "Analysing Network..." : "Generate Recommendations"}
              </button>
            )}
          </div>

          {/* Last generation result */}
          {lastGenResult && (
            <div className="mx-auto max-w-7xl mt-4">
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-800 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>{lastGenResult.scenarios_evaluated}</strong> shortage scenarios evaluated →{" "}
                  <strong>{lastGenResult.recommendations_created}</strong> ranked recommendations generated.{" "}
                  {lastGenResult.message}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
          {/* KPI Cards */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 backdrop-blur">
              <div className="text-xs text-slate-400">Total Recommendations</div>
              <div className="text-3xl font-black text-white mt-1">{loading ? "..." : recs.length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Across all scenarios</div>
            </div>
            <div className="rounded-2xl border border-rose-900/80 bg-rose-950/20 p-4 backdrop-blur ring-1 ring-rose-500/20">
              <div className="text-xs font-bold text-rose-300">Critical (≤3d stockout)</div>
              <div className="text-3xl font-black text-rose-400 mt-1">{loading ? "..." : criticalCount}</div>
              <div className="text-[11px] text-rose-300/70 mt-0.5">Emergency transfer needed</div>
            </div>
            <div className="rounded-2xl border border-emerald-900/80 bg-emerald-950/20 p-4 backdrop-blur ring-1 ring-emerald-500/20">
              <div className="text-xs font-bold text-emerald-300">Total Units to Redistribute</div>
              <div className="text-3xl font-black text-emerald-400 mt-1">{loading ? "..." : totalUnits.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-300/70 mt-0.5">Across all recommendations</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4 backdrop-blur">
              <div className="text-xs text-slate-400">Avg. AI Score</div>
              <div className="text-3xl font-black text-white mt-1 font-mono">
                {loading ? "..." : avgScore.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Score range: -2 to +4</div>
            </div>
          </section>

          {/* Filters */}
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search medicine, facility, warehouse..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs overflow-x-auto">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === s ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s === "ALL" ? "All Statuses" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendations List */}
          {loading ? (
            <div className="text-center text-slate-500 py-12">Loading redistribution recommendations...</div>
          ) : filteredRecs.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-12 text-center">
              <Zap className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">No recommendations found.</p>
              {isAdmin && (
                <p className="text-slate-500 text-sm mt-1">
                  Click <strong>Generate Recommendations</strong> to run the Redistribution Engine.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-mono mb-2">
                Showing {filteredRecs.length} recommendation{filteredRecs.length !== 1 ? "s" : ""}, ranked by AI score ↓
              </p>
              {filteredRecs.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
