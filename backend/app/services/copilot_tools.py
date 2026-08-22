import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import Facility, InventoryBatch, Medicine, RedistributionRecommendation, StockTransfer
from app.services.expiry_service import evaluate_expiry_risks
from app.services.risk_engine import evaluate_stockout_risks


def tool_critical_facilities(db: Session, district_id: uuid.UUID | None = None) -> dict[str, Any]:
    assessment = evaluate_stockout_risks(db, district_id=district_id)
    critical_items = [r for r in assessment.risks if r.risk_level in ["CRITICAL", "HIGH_RISK"]]

    fac_summary = []
    for item in critical_items[:10]:
        fac_summary.append({
            "facility_name": item.facility_name,
            "facility_type": item.facility_type,
            "medicine_name": item.medicine_name,
            "current_stock": item.current_usable_stock,
            "days_to_stockout": item.days_to_stockout,
            "risk_level": item.risk_level,
            "recommended_action": item.recommended_action,
        })

    return {
        "intent": "CRITICAL_FACILITIES",
        "total_critical_count": assessment.kpis.critical_count,
        "total_high_risk_count": assessment.kpis.high_risk_count,
        "most_vulnerable_facility": assessment.kpis.most_vulnerable_facility,
        "critical_items": fac_summary,
    }


def tool_expiring_medicines(db: Session, district_id: uuid.UUID | None = None) -> dict[str, Any]:
    assessment = evaluate_expiry_risks(db, district_id=district_id)
    opps = assessment.rescue_opportunities[:10]

    opp_summary = []
    for opp in opps:
        opp_summary.append({
            "source_facility": opp.source_facility_name or opp.source_warehouse_name,
            "medicine_name": opp.medicine_name,
            "batch_number": opp.batch_number,
            "expiry_date": str(opp.expiry_date),
            "days_until_expiry": opp.days_until_expiry,
            "rescueable_surplus": opp.rescueable_surplus,
            "priority": opp.priority,
        })

    return {
        "intent": "EXPIRING_MEDICINES",
        "expiring_soon_batch_count": assessment.kpis.expiring_soon_count,
        "total_rescueable_surplus_units": assessment.kpis.total_rescueable_surplus_units,
        "most_vulnerable_medicine": assessment.kpis.most_vulnerable_medicine,
        "rescue_opportunities": opp_summary,
    }


def tool_pending_transfers(db: Session, district_id: uuid.UUID | None = None) -> dict[str, Any]:
    transfers = db.scalars(
        select(StockTransfer).where(StockTransfer.status == "PENDING").order_by(StockTransfer.created_at.desc())
    ).all()

    recs = db.scalars(
        select(RedistributionRecommendation).where(RedistributionRecommendation.status == "RECOMMENDED").order_by(RedistributionRecommendation.score.desc())
    ).all()

    pending_list = []
    for t in transfers[:10]:
        med = db.get(Medicine, t.medicine_id)
        src_fac = db.get(Facility, t.source_facility_id) if t.source_facility_id else None
        dest_fac = db.get(Facility, t.destination_facility_id)
        pending_list.append({
            "tracking_number": t.tracking_number,
            "source": src_fac.name if src_fac else "Warehouse",
            "destination": dest_fac.name if dest_fac else "Unknown",
            "medicine": med.name if med else "Medicine",
            "quantity": t.quantity,
            "status": t.status,
            "notes": t.notes,
        })

    rec_list = []
    for r in recs[:5]:
        med = db.get(Medicine, r.medicine_id)
        src_fac = db.get(Facility, r.source_facility_id) if r.source_facility_id else None
        dest_fac = db.get(Facility, r.destination_facility_id)
        rec_list.append({
            "recommendation_id": str(r.id),
            "source": src_fac.name if src_fac else "Warehouse",
            "destination": dest_fac.name if dest_fac else "Unknown",
            "medicine": med.name if med else "Medicine",
            "quantity": r.recommended_quantity,
            "score": r.score,
        })

    return {
        "intent": "PENDING_TRANSFERS",
        "pending_transfers_count": len(transfers),
        "unreviewed_recommendations_count": len(recs),
        "pending_transfers": pending_list,
        "top_recommendations": rec_list,
    }


def tool_surplus_shortage_match(
    db: Session, medicine_name_query: str = "ORS", district_id: uuid.UUID | None = None
) -> dict[str, Any]:
    meds = db.scalars(
        select(Medicine).where(Medicine.name.ilike(f"%{medicine_name_query}%"))
    ).all()
    if not meds:
        meds = db.scalars(select(Medicine)).all()

    target_med = meds[0] if meds else None
    if not target_med:
        return {"intent": "MEDICINE_SURPLUS_SHORTAGE", "message": "No medicine matching query found."}

    # Evaluate network risks for this medicine
    assessment = evaluate_stockout_risks(db, district_id=district_id)
    shortage_items = [r for r in assessment.risks if r.medicine_id == target_med.id and r.days_to_stockout <= 14]
    total_shortage_qty = sum(max(0, r.safety_stock_required - r.current_usable_stock) for r in shortage_items)

    exp_assessment = evaluate_expiry_risks(db, district_id=district_id)
    surplus_opps = [o for o in exp_assessment.rescue_opportunities if o.medicine_id == target_med.id]
    total_surplus_qty = sum(o.rescueable_surplus for o in surplus_opps)

    can_cover = total_surplus_qty >= total_shortage_qty if total_shortage_qty > 0 else True

    return {
        "intent": "MEDICINE_SURPLUS_SHORTAGE",
        "medicine_name": target_med.name,
        "total_shortage_quantity": total_shortage_qty,
        "total_surplus_quantity": total_surplus_qty,
        "can_district_surplus_solve_shortage": can_cover,
        "shortage_facilities_count": len(shortage_items),
        "surplus_facilities_count": len(surplus_opps),
        "shortage_details": [
            {"facility": r.facility_name, "days_to_stockout": r.days_to_stockout, "stock": r.current_usable_stock}
            for r in shortage_items
        ],
        "surplus_details": [
            {"facility": o.source_facility_name or o.source_warehouse_name, "surplus": o.rescueable_surplus}
            for o in surplus_opps
        ],
    }


def tool_vulnerable_facility_ranking(db: Session, district_id: uuid.UUID | None = None) -> dict[str, Any]:
    assessment = evaluate_stockout_risks(db, district_id=district_id)
    kpis = assessment.kpis

    from collections import defaultdict
    fac_scores = defaultdict(lambda: {"critical": 0, "high": 0, "at_risk": 0, "total_score": 0})

    for r in assessment.risks:
        if r.risk_level == "CRITICAL":
            fac_scores[r.facility_name]["critical"] += 1
            fac_scores[r.facility_name]["total_score"] += 3
        elif r.risk_level == "HIGH_RISK":
            fac_scores[r.facility_name]["high"] += 1
            fac_scores[r.facility_name]["total_score"] += 2
        elif r.risk_level == "AT_RISK":
            fac_scores[r.facility_name]["at_risk"] += 1
            fac_scores[r.facility_name]["total_score"] += 1

    ranked = sorted(fac_scores.items(), key=lambda x: x[1]["total_score"], reverse=True)

    return {
        "intent": "FACILITY_RISK_RANKING",
        "most_vulnerable_facility": kpis.most_vulnerable_facility,
        "most_vulnerable_medicine": kpis.most_vulnerable_medicine,
        "ranked_facilities": [
            {"facility_name": name, "vulnerability_score": data["total_score"], "critical_medicines": data["critical"]}
            for name, data in ranked[:10]
        ],
    }
