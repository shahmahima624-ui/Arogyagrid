# AarogyaGrid

**Predict. Redistribute. Prevent.**

AarogyaGrid is a medicine supply resilience platform for public healthcare facilities. It will help district teams monitor inventory, forecast consumption, identify stock-out risk, rescue medicines approaching expiry, and safely recommend human-approved redistribution.

## Phase 0 status

This repository now provides the Phase 1 operational foundation:

- Next.js, TypeScript, and Tailwind CSS frontend
- FastAPI backend with `GET /api/health`
- Environment-driven PostgreSQL configuration
- Docker Compose PostgreSQL service and optional application containers
- Frontend-to-backend health connectivity check
- Core district, facility, warehouse, medicine, inventory, and consumption APIs
- Alembic migration scaffold and deterministic synthetic seed script
- Facilities, inventory, consumption, and dashboard pages

Forecasting, risk assessment, transfers, authentication, and AI features have not been implemented yet.

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

1. Copy `.env.example` to `.env` and replace development secrets as appropriate.
2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
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
