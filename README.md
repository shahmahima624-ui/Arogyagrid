# AarogyaGrid — AI-Powered National Health Mission Supply Chain Resilience Platform

AarogyaGrid is an end-to-end, production-ready AI supply chain resilience platform built for the **National Health Mission (NHM)**. It prevents stockouts of essential medicines across Primary Health Centres (PHCs), Community Health Centres (CHCs), and District Hospitals through real-time telemetry, predictive demand forecasting, FEFO expiry rescue, automated redistribution, voice inventory reporting, multimodal register digitisation, interactive Leaflet geo-mapping, and what-if stress simulation.

---

## 🏛️ System Architecture

```text
               +-------------------------------------------+
               |        Next.js 15 Tailwind Frontend        |
               |  (21 Client Routes, Dark Cyber Aesthetic)  |
               +---------------------+---------------------+
                                     |
                                     v
               +-------------------------------------------+
               |          FastAPI Backend (Python)         |
               |  (17 Module Services, RBAC, Pydantic)      |
               +----------+----------------------+----------+
                          |                      |
                          v                      v
      +-----------------------+              +-----------------------+
      |  Supabase PostgreSQL  |              |   Google Gemini 2.5   |
      |   (Live Relational)   |              |  (Multimodal & Copilot)|
      +-----------------------+              +-----------------------+
```

---

## 📋 Comprehensive Feature Map (Phases 1 – 17)

1. **Phase 1 — Core Domain Models**: Relational schemas for Districts, Facilities, Warehouses, Medicines, Inventory Batches, Consumption Records, and Audit Logs.
2. **Phase 2 — Auth & RBAC**: Firebase JWT authentication & role-based middleware (`DISTRICT_ADMIN`, `FACILITY_ADMIN`, `HEALTHCARE_STAFF`, `WAREHOUSE_MANAGER`).
3. **Phase 3 — Command Centre Dashboard**: Real-time district supply KPIs, critical facility alerts, and stock health meters.
4. **Phase 4 — Consumption Intelligence**: Daily patient consumption records, 30-day moving averages, and consumption anomaly detection.
5. **Phase 5 — Demand Forecasting Engine**: Multi-horizon demand prediction (7-day, 30-day, 90-day forecasts) combining exponential smoothing and trend analysis.
6. **Phase 6 — Stockout Risk Engine**: Precise Days-to-Stockout (DTS) calculation, stockout window alerts (Critical ≤3d, High ≤7d, Medium ≤14d).
7. **Phase 7 — FEFO Expiry Rescue**: First-Expiry-First-Out candidate detection matching batches expiring ≤90 days with safe surplus facilities.
8. **Phase 8 — AI Redistribution Engine**: Transparent multi-factor scoring formula incorporating Haversine geodesic distance penalties to match surplus and shortage facilities.
9. **Phase 9 — Human Approval & Stock Transfers**: Complete lifecycle management (`PENDING` → `APPROVED` → `IN_TRANSIT` → `RECEIVED`) with inventory batch auto-reconciliation and audit logging.
10. **Phase 10 — Gemini AI Explanations**: Natural language explanations for risk scores and redistribution proposals with deterministic fallback parser.
11. **Phase 11 — AI Supply Copilot**: Intent-driven assistant (`POST /api/ai/copilot`) executing backend query tools to answer natural language supply questions with raw factual JSON drawers.
12. **Phase 12 — Voice Inventory Reporting**: Frontline speech reporting parsing Hindi, Hinglish, and English voice input into human-editable verification forms.
13. **Phase 13 — Register Image Digitisation**: Gemini multimodal OCR parsing handwritten paper medicine stock register photos into structured inventory tables.
14. **Phase 14 — Geographic Network Map**: Leaflet.js interactive map featuring 5-color facility risk markers and vector transfer routes between healthcare nodes.
15. **Phase 15 — Health Supply Stress Simulator**: What-if surge simulation (+30%, +50% demand, supply delays) projecting 30-day stock trajectories and emergency stock buffers.
16. **Phase 16 — Production Containerization & Reports**: Docker, Docker Compose, Nginx reverse proxy, streaming CSV exports, printable National Health Mission dispatch manifests, and PWA manifest.
17. **Phase 17 — System Health & Telemetry**: Diagnostics endpoint (`GET /api/health/diagnostics`) reporting live database latency, table record counters, and memory usage.
18. **Phase 18 — Demo Seed Generator**: Automated seed data generator (`POST /api/demo/seed`) populating 5 Gujarat districts, 15 healthcare facilities, essential medicine catalogs, inventory batches, and 30-day consumption history.


---

## ⚡ Quick Start & Setup

### Prerequisites
- Python 3.14+
- Node.js 22+
- Docker & Docker Compose (optional for production deployment)

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run pytest suite
PYTHONPATH=. venv/bin/pytest

# Start development server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps

# Build Next.js bundle
npm run build

# Start development server
npm run dev
```

### 3. Docker Deployment
```bash
# Build and run backend, frontend, and Nginx reverse proxy
docker compose up --build -d
```

---

## 🛡️ License & Credits

Built for the **National Health Mission (NHM)** to guarantee zero preventable stockouts of essential life-saving medicines.
