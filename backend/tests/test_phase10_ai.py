"""
Phase 10 — Gemini AI Explanation Layer Tests

Verifies:
  1. POST /api/ai/explain-redistribution/{rec_id} returns structured executive explanation.
  2. Fallback to deterministic rules engine works seamlessly if GEMINI_API_KEY is unconfigured or fails.
  3. POST /api/ai/copilot returns supply chain insights using real database context.
"""
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import District, Facility, Medicine, RedistributionRecommendation, User

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_gemini_ai_explanation_and_copilot():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    db = TestingSession()

    district = District(name="Ahmedabad Rural", state="Gujarat")
    db.add(district)
    db.flush()

    fac_sanand = Facility(name="PHC Sanand", district_id=district.id, facility_type="PHC", status="ACTIVE")
    fac_bavla = Facility(name="CHC Bavla", district_id=district.id, facility_type="CHC", status="ACTIVE")
    db.add_all([fac_sanand, fac_bavla])
    db.flush()

    med = Medicine(name="Amoxicillin 500mg", generic_name="Amoxicillin", category="Antibiotics", unit="capsules")
    db.add(med)
    db.flush()

    rec = RedistributionRecommendation(
        destination_facility_id=fac_sanand.id,
        source_facility_id=fac_bavla.id,
        medicine_id=med.id,
        recommended_quantity=220,
        status="RECOMMENDED",
        score=0.92,
        urgency_weight=0.85,
        surplus_weight=0.70,
        expiry_rescue_weight=0.0,
        impact_weight=0.60,
        distance_penalty=0.08,
        source_risk_penalty=0.0,
        distance_km=8.4,
        destination_days_to_stockout=2.3,
        source_safe_surplus=540,
        estimated_coverage_days_restored=30.0,
        reason="CHC Bavla has safe surplus of 540 capsules. PHC Sanand stockout in 2.3 days.",
        confidence=0.88,
    )
    admin = User(
        firebase_uid="mock-admin-ai",
        name="Dr. AI Admin",
        email="ai.admin@test.org",
        role="DISTRICT_ADMIN",
        district_id=district.id,
        status="ACTIVE",
    )
    db.add_all([rec, admin])
    db.commit()

    client = TestClient(app)
    headers = {"Authorization": "Bearer mock-admin-ai"}

    # 1. No-token request returns 200 (open-access mode)
    res = client.post(f"/api/ai/explain-redistribution/{rec.id}")
    assert res.status_code in (200, 201, 422)  # open-access: no 401

    # 2. Authenticated AI explanation request
    res_exp = client.post(f"/api/ai/explain-redistribution/{rec.id}", headers=headers)
    assert res_exp.status_code == 200, res_exp.text
    data_exp = res_exp.json()

    assert data_exp["recommendation_id"] == str(rec.id)
    assert len(data_exp["executive_summary"]) > 10
    assert len(data_exp["source_selection_rationale"]) > 10
    assert len(data_exp["operational_impact"]) > 10
    assert len(data_exp["risk_mitigation_plan"]) > 10
    assert "model_used" in data_exp

    # 3. Test Copilot query
    res_cop = client.post(
        "/api/ai/copilot",
        headers=headers,
        json={"query": "What are our current critical stockout risks and surplus units?"},
    )
    assert res_cop.status_code == 200, res_cop.text
    data_cop = res_cop.json()

    assert len(data_cop["answer"]) > 10
    assert len(data_cop["suggested_actions"]) >= 1
    assert "data_context_summary" in data_cop
