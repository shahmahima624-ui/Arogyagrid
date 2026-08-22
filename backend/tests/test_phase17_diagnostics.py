"""
Phase 17 — System Diagnostics & Telemetry Tests

Verifies:
  1. GET /api/health returns lightweight status ok.
  2. GET /api/health/diagnostics returns database latency, row counts, and AI engine telemetry.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


def test_system_diagnostics_telemetry():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_db

    client = TestClient(app)

    # Liveness check
    res_live = client.get("/api/health")
    assert res_live.status_code == 200
    assert res_live.json()["status"] == "ok"

    # Detailed diagnostics check
    res_diag = client.get("/api/health/diagnostics")
    assert res_diag.status_code == 200
    data = res_diag.json()

    assert data["status"] == "HEALTHY"
    assert "database" in data
    assert data["database"]["status"] == "CONNECTED"
    assert "latency_ms" in data["database"]
    assert "ai_engine" in data
    assert data["active_phases_count"] == 17
