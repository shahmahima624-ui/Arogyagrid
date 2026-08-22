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
    """
    Answers network resilience questions via intent classification and deterministic tool retrieval.
    Gemini or rule-based fallback synthesises retrieved facts.
    """
    from app.services import copilot_tools

    q_lower = query.lower()

    # Intent Detection & Tool Dispatch
    if any(k in q_lower for k in ["critical", "this week", "urgent", "immediate"]):
        facts_dict = copilot_tools.tool_critical_facilities(db, district_id=district_id)
        intent = "CRITICAL_FACILITIES"
        actions = [
            "Review CRITICAL stockouts in Risk Engine (/risks)",
            "Generate inter-facility redistribution recommendations (/redistribution)",
        ]
    elif any(k in q_lower for k in ["expire", "expiry", "wastage", "rescue"]):
        facts_dict = copilot_tools.tool_expiring_medicines(db, district_id=district_id)
        intent = "EXPIRING_MEDICINES"
        actions = [
            "View candidate batches for FEFO expiry rescue (/expiry-rescue)",
            "Initiate inter-facility stock transfers (/transfers)",
        ]
    elif any(k in q_lower for k in ["transfer", "approve", "pending", "today"]):
        facts_dict = copilot_tools.tool_pending_transfers(db, district_id=district_id)
        intent = "PENDING_TRANSFERS"
        actions = [
            "Approve pending stock transfers (/transfers)",
            "Review AI redistribution proposals (/redistribution)",
        ]
    elif any(k in q_lower for k in ["highest", "vulnerable", "ranking", "worst", "facility risk", "highest medicine risk"]):
        facts_dict = copilot_tools.tool_vulnerable_facility_ranking(db, district_id=district_id)
        intent = "FACILITY_RISK_RANKING"
        actions = [
            "Inspect vulnerable facility profile (/facilities)",
            "Review stockout risk metrics (/risks)",
        ]
    elif any(k in q_lower for k in ["ors", "surplus solve", "shortage", "solve all"]):
        med_query = "ORS" if "ors" in q_lower else "Insulin" if "insulin" in q_lower else "Amoxicillin"
        facts_dict = copilot_tools.tool_surplus_shortage_match(db, medicine_name_query=med_query, district_id=district_id)
        intent = "MEDICINE_SURPLUS_SHORTAGE"
        actions = [
            "Review medicine stockout forecasts (/forecasts)",
            "Trigger surplus redistribution (/redistribution)",
        ]

    else:
        crit_facts = copilot_tools.tool_critical_facilities(db, district_id=district_id)
        exp_facts = copilot_tools.tool_expiring_medicines(db, district_id=district_id)
        trf_facts = copilot_tools.tool_pending_transfers(db, district_id=district_id)
        facts_dict = {
            "intent": "GENERAL_SUMMARY",
            "critical_facilities": crit_facts,
            "expiring_medicines": exp_facts,
            "transfers": trf_facts,
        }
        intent = "GENERAL_SUMMARY"
        actions = [
            "Monitor Command Centre dashboard (/dashboard)",
            "Review Stock-Out risks (/risks)",
        ]

    summary_text = f"Retrieved Database Facts (Intent: {intent}): {json.dumps(facts_dict)[:500]}..."

    settings = get_settings()

    if not settings.gemini_api_key:
        if intent == "CRITICAL_FACILITIES":
            answer = (
                f"AarogyaGrid Database Findings for Critical Facilities:\n"
                f"• Total Critical Stockouts: {facts_dict.get('total_critical_count', 0)}\n"
                f"• High Risk Facilities: {facts_dict.get('total_high_risk_count', 0)}\n"
                f"• Most Vulnerable Node: {facts_dict.get('most_vulnerable_facility', 'None')}\n"
                f"Top critical items require immediate inter-facility transfers from central supply."
            )
        elif intent == "EXPIRING_MEDICINES":
            answer = (
                f"AarogyaGrid Database Findings for Expiry Rescue:\n"
                f"• Batches Expiring ≤90 days: {facts_dict.get('expiring_soon_batch_count', 0)}\n"
                f"• Total Safe Surplus Available for Rescue: {facts_dict.get('total_rescueable_surplus_units', 0)} units\n"
                f"• Most Vulnerable Medicine: {facts_dict.get('most_vulnerable_medicine', 'None')}\n"
                f"High-priority FEFO rescue batches identified in network."
            )
        elif intent == "MEDICINE_SURPLUS_SHORTAGE":
            med = facts_dict.get("medicine_name", "Medicine")
            can_cover = facts_dict.get("can_district_surplus_solve_shortage", True)
            answer = (
                f"AarogyaGrid Surplus-Shortage Match for {med}:\n"
                f"• Total Shortage Demand: {facts_dict.get('total_shortage_quantity', 0)} units\n"
                f"• Total Safe Surplus in District: {facts_dict.get('total_surplus_quantity', 0)} units\n"
                f"• Can Surplus Solve All Shortages? {'YES! District surplus is sufficient.' if can_cover else 'NO. Additional central procurement required.'}"
            )
        elif intent == "PENDING_TRANSFERS":
            answer = (
                f"AarogyaGrid Pending Transfers Summary:\n"
                f"• Pending Transfers Awaiting Approval: {facts_dict.get('pending_transfers_count', 0)}\n"
                f"• Unreviewed AI Redistribution Recommendations: {facts_dict.get('unreviewed_recommendations_count', 0)}\n"
                f"Please review and approve pending stock transfers."
            )
        elif intent == "FACILITY_RISK_RANKING":
            answer = (
                f"AarogyaGrid Facility Vulnerability Ranking:\n"
                f"• Most Vulnerable Facility: {facts_dict.get('most_vulnerable_facility', 'None')}\n"
                f"• Most Vulnerable Medicine: {facts_dict.get('most_vulnerable_medicine', 'None')}\n"
                f"Ranked vulnerability list computed from 90-day consumption velocity and stock levels."
            )
        else:
            answer = f"AarogyaGrid Network Summary: System online with database context active."

        return CopilotQueryResponse(
            answer=answer,
            intent_detected=intent,
            retrieved_facts=facts_dict,
            suggested_actions=actions,
            data_context_summary=summary_text,
            model_used="deterministic-tools-retrieval (fallback)",
            as_of=datetime.now(timezone.utc),
        )

    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)

        prompt = f"""
You are AarogyaGrid Copilot, an AI supply-chain assistant for public healthcare administrators.
User Question: "{query}"

FACTS RETRIEVED FROM DATABASE (Intent: {intent}):
{json.dumps(facts_dict, indent=2)}

Instructions:
1. Synthesise the retrieved facts directly to answer the user's question.
2. Ensure every number and facility name stated corresponds strictly to the retrieved database facts above.
3. Be concise, direct, and focused on medicine supply-chain resilience.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        answer_text = response.text if response and response.text else summary_text

        return CopilotQueryResponse(
            answer=answer_text.strip(),
            intent_detected=intent,
            retrieved_facts=facts_dict,
            suggested_actions=actions,
            data_context_summary=summary_text,
            model_used="gemini-2.5-flash",
            as_of=datetime.now(timezone.utc),
        )
    except Exception as exc:
        logger.warning(f"Copilot Gemini call failed ({exc}). Falling back to deterministic tool response.")
        return CopilotQueryResponse(
            answer=f"Network Status (Intent: {intent}): Retrieved factual database state cleanly.",
            intent_detected=intent,
            retrieved_facts=facts_dict,
            suggested_actions=actions,
            data_context_summary=summary_text,
            model_used="deterministic-tools-retrieval (fallback)",
            as_of=datetime.now(timezone.utc),
        )
