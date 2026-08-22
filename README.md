# AarogyaGrid

**Predict. Redistribute. Prevent.**

AarogyaGrid is a medicine supply resilience platform for public healthcare facilities. It will help district teams monitor inventory, forecast consumption, identify stock-out risk, rescue medicines approaching expiry, and safely recommend human-approved redistribution.

## Current implementation status

This repository now provides the Phase 1 operational foundation:

- Next.js, TypeScript, and Tailwind CSS frontend
- FastAPI backend with `GET /api/health`
- Environment-driven PostgreSQL configuration
- Docker Compose PostgreSQL service and optional application containers
- Frontend-to-backend health connectivity check
- Core district, facility, warehouse, medicine, inventory, and consumption APIs
- Alembic migration scaffold and deterministic synthetic seed script
- Facilities, inventory, consumption, dashboard, and consumption intelligence pages
- Deterministic consumption aggregation, feature engineering, and a gap-filled facility-medicine time series API

Demand forecasting, stock-out risk assessment, transfers, and AI features have not been implemented yet.

## Phase 4: Consumption intelligence

`GET /api/consumption-intelligence/series` prepares a chronological daily series for one facility and medicine. It aggregates multiple records on the same day, fills missing days with zero consumption, excludes expired stock from `current_usable_stock`, and provides deterministic ML-ready features: lags (1/7/14), rolling means (7/14), rolling standard deviation, calendar features, patient count, and current stock.

Example:

```text
GET /api/consumption-intelligence/series?facility_id=<uuid>&medicine_id=<uuid>&days=90
```

The `/consumption-intelligence` frontend page provides a 90-day trend, average daily demand, and recent demand change. These are historical indicators, not forecasts.

## Project structure

```text
frontend/       Next.js application
backend/        FastAPI application and tests
docs/           Architecture and project documentation
docker-compose.yml
.env.example
```

## Phase 1 database setup

After PostgreSQL is available, apply the initial migration and seed synthetic demo data:

```bash
cd backend
alembic upgrade head
python scripts/seed.py
```

The seed creates one Gujarat district, nine facilities, one warehouse, 15 medicines, inventory batches, and 90 days of synthetic consumption. It is idempotent and contains no patient data.

## Local development

1. Copy `.env.example` to `.env` and set your `SUPABASE_DATABASE_URL` / `DATABASE_URL` credentials:

   ```bash
   SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```



3. Start the backend from `backend/`:

   ```bash
   python -m venv .venv
   .venv\\Scripts\\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

4. In another terminal, start the frontend from `frontend/`:

   ```bash
   npm install
   npm run dev
   ```

Open `http://localhost:3000`. The landing page reports whether it can reach the API.

## Verification

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{"status":"ok","service":"AarogyaGrid API"}
```

## Configuration

See `.env.example` for all Phase 0 environment variables. Do not commit `.env` files or credentials.
