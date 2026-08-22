import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.core import (
    Facility,
    InventoryBatch,
    Medicine,
    RedistributionRecommendation,
    StockTransfer,
    User,
    Warehouse,
)
from app.schemas.ai import CopilotQueryResponse, RedistributionExplanationResponse
from app.services.expiry_service import evaluate_expiry_risks
from app.services.risk_engine import evaluate_stockout_risks

logger = logging.getLogger(__name__)


def _deterministic_explanation(
    rec: RedistributionRecommendation,
    dest_name: str,
    src_name: str,
    med_name: str,
    unit: str,
) -> RedistributionExplanationResponse:
    """Fallback deterministic explanation when Gemini API is unavailable or unconfigured."""
    days_to_so = f"{rec.destination_days_to_stockout:.1f}" if rec.destination_days_to_stockout else "N/A"
    dist_str = f"{rec.distance_km:.1f} km" if rec.distance_km else "regional network"
    cov_str = f"~{rec.estimated_coverage_days_restored:.0f} days" if rec.estimated_coverage_days_restored else "extended coverage"

    exec_summary = (
        f"Recommended inter-facility redistribution of {rec.recommended_quantity} {unit} of {med_name} "
        f"from {src_name} to {dest_name}. This transfer directly prevents an imminent stockout projected in {days_to_so} days."
    )

    rationale = (
        f"Selected {src_name} as optimal supply source with a composite AI score of {rec.score:.2f}. "
        f"{src_name} maintains a safe surplus of {rec.source_safe_surplus or 'adequate'} {unit} beyond its local 30-day requirement and safety stock floor. "
        f"Transit distance is {dist_str}, minimizing logistics risk."
    )

    impact = (
        f"Restores {cov_str} of dispensing inventory at {dest_name}, elevating stock levels above safety thresholds "
        f"and providing sufficient lead time for standard central procurement replenishment."
    )

    mitigation = (
        f"Ensure dispatch via temperature-controlled transport if required. Source facility stock remains protected above safety stock floor. "
        f"Destination staff must verify batch numbers and log receipt in AarogyaGrid to complete inventory reconciliation."
    )

    return RedistributionExplanationResponse(
        recommendation_id=rec.id,
        executive_summary=exec_summary,
        source_selection_rationale=rationale,
        operational_impact=impact,
        risk_mitigation_plan=mitigation,
        model_used="deterministic-rules-engine (fallback)",
        generated_at=datetime.now(timezone.utc),
    )


def explain_redistribution_recommendation(
    db: Session,
    recommendation_id: uuid.UUID,
) -> RedistributionExplanationResponse:
    rec = db.get(RedistributionRecommendation, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Redistribution recommendation not found.")

    dest_fac = db.get(Facility, rec.destination_facility_id)
    med = db.get(Medicine, rec.medicine_id)

    src_fac = db.get(Facility, rec.source_facility_id) if rec.source_facility_id else None
    src_wh = db.get(Warehouse, rec.source_warehouse_id) if rec.source_warehouse_id else None

    dest_name = dest_fac.name if dest_fac else "Destination Facility"
    src_name = src_fac.name if src_fac else (src_wh.name if src_wh else "Central Warehouse")
    med_name = med.name if med else "Medicine"
    unit = med.unit if med else "units"

    settings = get_settings()

    if not settings.gemini_api_key:
        logger.info("GEMINI_API_KEY not configured. Falling back to deterministic explanation.")
        return _deterministic_explanation(rec, dest_name, src_name, med_name, unit)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)

        facts = {
            "destination_facility": dest_name,
            "source": src_name,
            "medicine": med_name,
            "recommended_quantity": rec.recommended_quantity,
            "unit": unit,
            "destination_days_to_stockout": rec.destination_days_to_stockout,
            "source_safe_surplus": rec.source_safe_surplus,
            "distance_km": rec.distance_km,
            "estimated_coverage_days_restored": rec.estimated_coverage_days_restored,
            "composite_score": rec.score,
            "score_breakdown": {
                "urgency_weight": rec.urgency_weight,
                "surplus_weight": rec.surplus_weight,
                "expiry_rescue_weight": rec.expiry_rescue_weight,
                "impact_weight": rec.impact_weight,
                "distance_penalty": rec.distance_penalty,
                "source_risk_penalty": rec.source_risk_penalty,
            },
            "engine_reason": rec.reason,
        }

        prompt = f"""
You are Gemini AI, the intelligence core of AarogyaGrid medicine supply resilience network.
Analyse the following structured redistribution facts and provide a clear, professional executive explanation.

FACTS:
{json.dumps(facts, indent=2)}

You MUST respond strictly in valid JSON format matching this schema:
{{
  "executive_summary": "1-2 sentences summarizing the recommendation and immediate stockout prevention goal",
  "source_selection_rationale": "Detailed explanation of why this source was selected based on surplus, distance, and scoring breakdown",
  "operational_impact": "Operational and clinical benefit of restoring coverage at the destination facility",
  "risk_mitigation_plan": "Risk mitigation steps (safety stock protection, logistics, receipt verification)"
}}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )

        raw_text = response.text if response and response.text else ""
        parsed = json.loads(raw_text)

        return RedistributionExplanationResponse(
            recommendation_id=rec.id,
            executive_summary=parsed.get("executive_summary", ""),
            source_selection_rationale=parsed.get("source_selection_rationale", ""),
            operational_impact=parsed.get("operational_impact", ""),
            risk_mitigation_plan=parsed.get("risk_mitigation_plan", ""),
            model_used="gemini-2.5-flash",
            generated_at=datetime.now(timezone.utc),
        )
    except Exception as exc:
        logger.warning(f"Gemini API call failed ({exc}). Falling back to deterministic explanation.")
        return _deterministic_explanation(rec, dest_name, src_name, med_name, unit)


def ask_copilot(
    db: Session,
    query: str,
    user: User,
    district_id: uuid.UUID | None = None,
) -> CopilotQueryResponse:
    """Answers network resilience questions using real DB facts and Gemini or deterministic fallback."""
    # Gather live network facts
    risk_assessment = evaluate_stockout_risks(db, district_id=district_id)
    expiry_assessment = evaluate_expiry_risks(db, district_id=district_id)

    pending_transfers = db.scalars(
        select(StockTransfer).where(StockTransfer.status == "PENDING")
    ).all()

    recs = db.scalars(
        select(RedistributionRecommendation).where(RedistributionRecommendation.status == "RECOMMENDED")
    ).all()

    kpis_risk = risk_assessment.kpis
    kpis_exp = expiry_assessment.kpis

    summary_text = (
        f"Network State: {kpis_risk.critical_count} CRITICAL stockouts, "
        f"{kpis_risk.high_risk_count} HIGH risk items. "
        f"Expiry risks: {kpis_exp.expiring_soon_count} batches expiring ≤90d ({kpis_exp.total_rescueable_surplus_units} surplus units ready to rescue). "
        f"Pending transfers: {len(pending_transfers)}. Recommendations ready: {len(recs)}."
    )

    actions = [
        "Review CRITICAL stockout risks in Risk Engine (/risks)",
        "Approve pending inter-facility transfers (/transfers)",
        "Trigger FEFO expiry rescue redistribution (/expiry-rescue)",
    ]

    settings = get_settings()

    if not settings.gemini_api_key:
        answer = (
            f"AarogyaGrid Copilot Status:\n"
            f"Based on real-time database monitoring, the network currently has {kpis_risk.critical_count} critical stockout risks "
            f"and {kpis_exp.total_rescueable_surplus_units} surplus units eligible for expiry rescue. "
            f"Most vulnerable facility: {kpis_risk.most_vulnerable_facility or 'None'}. "
            f"Most vulnerable medicine: {kpis_risk.most_vulnerable_medicine or 'None'}."
        )
        return CopilotQueryResponse(
            answer=answer,
            suggested_actions=actions,
            data_context_summary=summary_text,
            model_used="deterministic-rules-engine (fallback)",
            as_of=datetime.now(timezone.utc),
        )

    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)

        prompt = f"""
You are AarogyaGrid Copilot, an AI supply-chain assistant for public healthcare administrators.
User Question: "{query}"

Real-Time Network Facts:
{summary_text}

Provide a concise, direct, helpful answer focusing purely on medicine supply resilience, stockout prevention, and inventory redistribution.
Do not discuss unrelated medical topics or treatment advice.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        answer_text = response.text if response and response.text else summary_text

        return CopilotQueryResponse(
            answer=answer_text.strip(),
            suggested_actions=actions,
            data_context_summary=summary_text,
            model_used="gemini-2.5-flash",
            as_of=datetime.now(timezone.utc),
        )
    except Exception as exc:
        logger.warning(f"Copilot Gemini call failed ({exc}). Falling back to deterministic answer.")
        answer = (
            f"Network Status Summary:\n"
            f"• Critical Stockouts: {kpis_risk.critical_count}\n"
            f"• High Risk Facilities: {kpis_risk.high_risk_count}\n"
            f"• Rescueable Surplus: {kpis_exp.total_rescueable_surplus_units} units\n"
            f"• Pending Transfers: {len(pending_transfers)}"
        )
        return CopilotQueryResponse(
            answer=answer,
            suggested_actions=actions,
            data_context_summary=summary_text,
            model_used="deterministic-rules-engine (fallback)",
            as_of=datetime.now(timezone.utc),
        )
