<div align="center">

# AarogyaGrid

### AI-Powered Medicine Supply Resilience Network for Public Healthcare

**Predict. Redistribute. Prevent.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=flat-square&logo=python)](https://python.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Google-Gemini_2.5-4285F4?style=flat-square&logo=google)](https://deepmind.google/gemini)

</div>

---

## 📌 Overview

AarogyaGrid is an **AI-powered Medicine Supply Resilience Network** for the National Health Mission (NHM). It connects Primary Health Centres (PHCs), Community Health Centres (CHCs), District Hospitals, and Warehouses across India — preventing medicine stockouts, rescuing near-expiry inventory, and intelligently redistributing stock across facilities in real-time.

> **Over 60% of India's rural PHCs face critical medicine stockouts annually.** Simultaneously, near-expiry medicines are wasted in overstocked facilities a few kilometres away. AarogyaGrid solves both problems with AI-driven forecasting, real-time risk detection, and a human-approved transfer lifecycle.

---

## ✨ Features

- 📊 **Demand Forecasting** — 7-day, 30-day, and 90-day predictions using trend models
- ⚠️ **Stockout Risk Engine** — Days-to-Stockout classification (Critical / High / Medium / Safe)
- ♻️ **FEFO Expiry Rescue** — Matches near-expiry surplus batches to shortage facilities
- 🤖 **AI Redistribution Engine** — Haversine-aware multi-factor scoring for transfer proposals
- ✅ **Human Approval Lifecycle** — `PENDING → APPROVED → IN_TRANSIT → RECEIVED`
- 💬 **AI Supply Copilot** — Natural language supply queries powered by Gemini 2.5
- 🎙️ **Voice Inventory Reporting** — Hindi, Hinglish, and English voice-to-inventory
- 📷 **Register Image Digitisation** — Multimodal OCR on handwritten paper medicine registers
- 🗺️ **Geographic Network Map** — Live risk markers and transfer routes on Leaflet.js
- 🧪 **Stress Simulator** — What-if surge simulations (+30%, +50% demand spikes)
- 🌡️ **Cold-Chain Telemetry** — Vaccine/insulin temperature monitoring (2°C – 8°C)
- 📡 **Real-Time SSE Alerts** — Server-Sent Events stream for live stockout and cold-chain alerts
- 📄 **NHM Dispatch Manifests** — Printable PDF transfer receipts with SHA-256 verification
- 🩺 **System Diagnostics** — Live DB latency, record counts, and memory telemetry

---

## 🏛️ Architecture

```
+------------------------------------------+
|         Next.js 15 Frontend              |
|    21 Pages  •  TypeScript  •  Tailwind  |
+-------------------+----------------------+
                    │
                    ▼  REST + SSE
+------------------------------------------+
|         FastAPI Backend (Python)         |
|  21 Service Modules  •  RBAC  •  Pydantic|
+-----------+-----------------+------------+
            │                 │
            ▼                 ▼
+-------------------+   +--------------------+
|  Supabase         |   |  Google Gemini 2.5 |
|  PostgreSQL       |   |  (AI + Multimodal) |
+-------------------+   +--------------------+
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Leaflet.js |
| Backend | FastAPI, Python 3.14, SQLAlchemy, Pydantic |
| Database | Supabase (PostgreSQL) |
| AI Engine | Google Gemini 2.5 Flash |
| Auth | Firebase Authentication (JWT) |
| Deployment | Docker, Docker Compose, Nginx |
| Realtime | Server-Sent Events (SSE) |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.14+
- Node.js 20+
- A Supabase project (free tier works)
- A Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/shahmahima624-ui/Arogyagrid.git
cd Arogyagrid
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Open .env and fill in your credentials (see Environment Variables section below)
```

### 3. Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API available at: `http://localhost:8000`  
Interactive docs at: `http://localhost:8000/docs`

### 4. Frontend

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm run dev
```

App available at: `http://localhost:3000`

---

## 🐳 Docker Deployment

Run the entire stack (backend + frontend + Nginx) with a single command:

```bash
# Build and start all containers in background
docker compose up --build -d

# View logs
docker compose logs -f

# Stop containers
docker compose down
```

---

## 🧪 Running Tests

```bash
cd backend
source venv/bin/activate

# Run all 21 test suites
PYTHONPATH=. pytest

# Verbose output
PYTHONPATH=. pytest -v

# Run a specific phase test
PYTHONPATH=. pytest tests/test_phase8_redistribution.py -v
```

Expected output: **21 passed** ✅

---

## 🔌 API Endpoints

| Module | Endpoint | Method | Description |
|---|---|---|---|
| Health | `/api/health` | `GET` | Liveness check |
| Diagnostics | `/api/health/diagnostics` | `GET` | DB latency, table counts, memory |
| Districts | `/api/districts` | `GET` | List all districts |
| Facilities | `/api/facilities` | `GET` `POST` | Healthcare facility management |
| Warehouses | `/api/warehouses` | `GET` `POST` | Warehouse management |
| Medicines | `/api/medicines` | `GET` `POST` | Medicine catalog |
| Inventory | `/api/inventory` | `GET` `POST` | Batch inventory management |
| Consumption | `/api/consumption` | `GET` `POST` | Daily consumption records |
| Auth | `/api/users/me` | `GET` | Current user profile |
| Dashboard | `/api/dashboard/kpis` | `GET` | District KPIs and alerts |
| Consumption Intel | `/api/consumption-intelligence` | `GET` | Averages and anomaly detection |
| Forecasting | `/api/forecasts/generate` | `POST` | 7d / 30d / 90d demand forecasts |
| Risk | `/api/risks` | `GET` `POST` | Days-to-stockout classification |
| Expiry Rescue | `/api/expiry/rescue-opportunities` | `GET` | Near-expiry surplus matching |
| Redistribution | `/api/redistribution/generate` | `POST` | Ranked redistribution proposals |
| Transfers | `/api/transfers` | `GET` `POST` | Transfer lifecycle management |
| | `/api/transfers/{id}/approve` | `POST` | Approve a pending transfer |
| | `/api/transfers/{id}/receive` | `POST` | Receive and reconcile inventory |
| AI Explanations | `/api/ai/explain` | `POST` | Gemini natural language explanations |
| AI Copilot | `/api/ai/copilot` | `POST` | Natural language supply assistant |
| Voice | `/api/voice/process-transcript` | `POST` | Parse voice input to structured draft |
| | `/api/voice/submit-report` | `POST` | Submit verified voice report |
| Register Scan | `/api/register/extract` | `POST` | Multimodal OCR on register photo |
| | `/api/register/submit` | `POST` | Submit digitised register to inventory |
| Geo Map | `/api/map/facilities` | `GET` | Risk markers and transfer route vectors |
| Simulator | `/api/simulations/run` | `POST` | What-if supply stress simulation |
| Reports | `/api/reports/export-csv` | `GET` | Streaming CSV export |
| | `/api/reports/dispatch-manifest/{id}` | `GET` | Printable NHM dispatch manifest |
| Demo Seed | `/api/demo/seed` | `POST` | Seed synthetic demo dataset |
| Backup | `/api/backup/create` | `POST` | Export JSON database snapshot |
| | `/api/backup/restore` | `POST` | Restore database from snapshot |
| Telemetry | `/api/telemetry/log-temperature` | `POST` | Cold-chain temperature log and alert |
| Events | `/api/events/stream` | `GET` | Real-time SSE alert stream |

---

## 🔑 Environment Variables

Create a `.env` file at the project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Firebase Auth
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# App
ENVIRONMENT=development
```

---

## 🔒 Responsible AI

- **Human-in-the-Loop** — Every AI redistribution proposal requires human approval before any inventory moves.
- **Deterministic Retrieval** — The AI Copilot queries the live database rather than generating answers from raw context.
- **Cryptographic Manifests** — Dispatch receipts include SHA-256 hashes for tamper-evident paper trails.
- **Advisory Only** — All AI outputs are advisory. Final authority rests with healthcare administrators.

---

## 📜 License

Built for the **National Health Mission (NHM)** to guarantee zero preventable medicine stockouts across India's public healthcare network.