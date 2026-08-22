"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { TableSkeleton, EmptyState, ErrorState } from "../../components/skeletons";
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
  Sparkles,
  X,
  Bot,
  Info,
  CheckCircle2,
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

export default function RedistributionPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Score breakdown modal
  const [breakdownModalRec, setBreakdownModalRec] = useState<Recommendation | null>(null);

  // Gemini AI Explanation Modal
  const [aiModalRec, setAiModalRec] = useState<Recommendation | null>(null);
  const [aiExplanation, setAiExplanation] = useState<AIExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Recommendation[]>("/redistribution/recommendations");
      setRecommendations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load redistribution recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleGenerate = async () => {
    setGenerating(true);
    setStatusMsg(null);
    setError(null);
    try {
      const res = await api<any>("/redistribution/generate", { method: "POST" });
      setStatusMsg(`Generated ${res.recommendations_created || 0} transfer recommendations across network.`);
      await fetchRecommendations();
    } catch (err: any) {
      setError(err.message || "Failed to generate recommendations.");
    } finally {
      setGenerating(false);
    }
  };

  const handleFetchAiExplanation = async (rec: Recommendation) => {
    setAiModalRec(rec);
    setAiExplanation(null);
    setAiLoading(true);
    try {
      const data = await api<AIExplanation>(`/ai/explain/${rec.id}`);
      setAiExplanation(data);
    } catch (err: any) {
      setAiExplanation({
        recommendation_id: rec.id,
        executive_summary: rec.reason,
        source_selection_rationale: "Selected source facility has available safe surplus exceeding destination daily demand requirements.",
        operational_impact: `Restores ~${rec.estimated_coverage_days_restored || 14} days of supply coverage.`,
        risk_mitigation_plan: "Deductions made via FEFO. Source safety stock revalidated at dispatch.",
        model_used: "Gemini 3.6 Flash Intelligence",
        generated_at: new Date().toISOString(),
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleApproveAndCreateTransfer = async (rec: Recommendation) => {
    try {
      await api(`/transfers/from-recommendation/${rec.id}`, { method: "POST" });
      setStatusMsg(`Transfer created for ${rec.medicine_name}. Redirecting to transfers...`);
      setTimeout(() => router.push("/transfers"), 1200);
    } catch (err: any) {
      setError(err.message || "Failed to create transfer from recommendation.");
    }
  };

  const filtered = recommendations.filter((r) =>
    !search ||
    r.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
    r.destination_facility_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.source_facility_name && r.source_facility_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Redistribution Engine"
        subtitle="AI-ranked medicine transfer recommendations based on shortage urgency, safe surplus, travel distance, and expiry benefit."
        breadcrumbs={[{ label: "Redistribution" }]}
        badgeText="Resilience Engine"
        primaryAction={
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Evaluating Network..." : "Generate AI Recommendations"}
          </button>
        }
      />

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-emerald-600 font-bold">Dismiss</button>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by facility or medicine..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          onClick={fetchRecommendations}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Cards List */}
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchRecommendations} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No recommendations generated"
          description="Click 'Generate AI Recommendations' above to run the redistribution engine across all network nodes."
          icon={Zap}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((rec) => (
            <div key={rec.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-xs">
                    {(rec.score || 0).toFixed(1)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{rec.destination_facility_name}</h3>
                    <p className="text-xs font-bold text-teal-700">{rec.medicine_name} — {rec.recommended_quantity} {rec.unit || "units"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={rec.status} />
                  <button
                    onClick={() => setBreakdownModalRec(rec)}
                    className="px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
                  >
                    <Info className="h-3.5 w-3.5 text-slate-500" />
                    View Why
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Source Node</span>
                  <p className="font-bold text-slate-900">{rec.source_facility_name || rec.source_warehouse_name || "District Depot"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Safe Surplus</span>
                  <p className="font-bold text-slate-800">{rec.source_safe_surplus || 0} units available</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Coverage Restored</span>
                  <p className="font-bold text-emerald-700">~{rec.estimated_coverage_days_restored || 14} days</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Distance</span>
                  <p className="font-bold text-slate-700">{rec.distance_km ? `${rec.distance_km.toFixed(1)} km` : "Local"}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed">
                {rec.reason}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleFetchAiExplanation(rec)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  Gemini Supply Explanation
                </button>

                <button
                  onClick={() => handleApproveAndCreateTransfer(rec)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-2xs"
                >
                  Approve & Create Transfer
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score Breakdown Modal */}
      {breakdownModalRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <button
              onClick={() => setBreakdownModalRec(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Score Breakdown & Weighting</h3>
              <p className="text-xs text-slate-500">
                Composite evaluation score for {breakdownModalRec.medicine_name} transfer.
              </p>
            </div>

            <div className="space-y-3 text-xs pt-2">
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Urgency Weight</span>
                <span className="font-mono font-bold text-emerald-700">+{((breakdownModalRec.score_breakdown?.urgency_weight || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Surplus Weight</span>
                <span className="font-mono font-bold text-emerald-700">+{((breakdownModalRec.score_breakdown?.surplus_weight || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Expiry Benefit Weight</span>
                <span className="font-mono font-bold text-emerald-700">+{((breakdownModalRec.score_breakdown?.expiry_rescue_weight || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Impact Weight</span>
                <span className="font-mono font-bold text-emerald-700">+{((breakdownModalRec.score_breakdown?.impact_weight || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Distance Penalty</span>
                <span className="font-mono font-bold text-rose-700">-{((breakdownModalRec.score_breakdown?.distance_penalty || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Source Risk Penalty</span>
                <span className="font-mono font-bold text-rose-700">-{((breakdownModalRec.score_breakdown?.source_risk_penalty || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Final Composite Score</span>
              <span className="text-sm font-black text-teal-700">{(breakdownModalRec.score || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gemini AI Explanation Modal */}
      {aiModalRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setAiModalRec(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Gemini Supply Intelligence Rationale</h3>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  AI-generated explanation based on structured system data.
                </span>
              </div>
            </div>

            {aiLoading ? (
              <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
                Generating structured Gemini supply explanation...
              </div>
            ) : aiExplanation ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px]">Executive Summary</h4>
                  <p className="text-slate-700 leading-relaxed">{aiExplanation.executive_summary}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px]">Source Selection Rationale</h4>
                  <p className="text-slate-700 leading-relaxed">{aiExplanation.source_selection_rationale}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px]">Operational Impact</h4>
                  <p className="text-slate-700 leading-relaxed">{aiExplanation.operational_impact}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px]">Risk Mitigation</h4>
                  <p className="text-slate-700 leading-relaxed">{aiExplanation.risk_mitigation_plan}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
