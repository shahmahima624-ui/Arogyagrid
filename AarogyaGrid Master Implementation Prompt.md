# AarogyaGrid — Master Implementation Prompt

You are acting as a **senior full-stack engineer, ML engineer, AI architect, database architect, and product engineer**.

Your task is to build **AarogyaGrid**, an AI-powered medicine supply resilience network for public healthcare facilities.

The system must be implemented **incrementally in phases**.

Do NOT attempt to build everything at once.

At the end of every phase:

1. Run and test the implementation.
2. Fix all critical errors.
3. Verify frontend-backend integration where applicable.
4. Summarise exactly what was implemented.
5. List files created or modified.
6. List known limitations.
7. Give clear instructions to test the phase.
8. STOP and wait for my approval before starting the next phase.

Never silently skip unfinished items.

---

# 1. PRODUCT IDENTITY

## Name

**AarogyaGrid**

## Tagline

**Predict. Redistribute. Prevent.**

## Description

AarogyaGrid is an **AI-powered Medicine Supply Resilience Network** connecting:

- PHCs
- CHCs
- District Hospitals
- Medicine Warehouses
- District Health Administrators

The system must predict medicine shortages, identify safe surplus inventory at neighbouring facilities, rescue medicines likely to expire, recommend redistribution, explain its recommendations through Gemini, and require human approval before inventory is modified.

This is NOT:

- a hospital management system
- a diagnosis platform
- a patient consultation application
- a prescription generator
- a medical chatbot

The primary focus is:

> **Medicine supply-chain intelligence and resilience.**

---

# 2. CORE SYSTEM PHILOSOPHY

Traditional inventory software:

```text
Record
  ↓
Display
  ↓
Alert
```

AarogyaGrid:

```text
Observe
  ↓
Predict
  ↓
Analyse
  ↓
Optimise
  ↓
Recommend
  ↓
Approve
  ↓
Verify
```

Every major implementation decision must support this philosophy.

---

# 3. CORE AI PRINCIPLE

Maintain strict separation of responsibilities.

```text
Machine Learning
      ↓
Prediction

Optimization / Algorithms
      ↓
Best Action

Rules
      ↓
Safety Constraints

Gemini
      ↓
Explanation + Natural Language

Human
      ↓
Final Approval
```

IMPORTANT:

Do NOT use Gemini to calculate demand forecasts.

Do NOT use Gemini to invent stock-out probabilities.

Do NOT let Gemini directly modify inventory.

Gemini should primarily:

- explain model outputs
- answer operational questions
- interpret voice input
- interpret register images
- convert structured results into readable recommendations

---

# 4. TECH STACK

## Frontend

Use:

- Next.js
- TypeScript
- Tailwind CSS

Prefer modern App Router architecture.

Use reusable components.

Avoid unnecessarily heavy UI libraries unless they substantially improve development speed.

---

# Backend

Use Python.

Framework:

**FastAPI**

Libraries:

- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- Supabase-compatible database configuration
- Pandas
- NumPy
- Scikit-learn
- XGBoost
- Celery
- Redis

---

# Authentication

Use:

**Firebase Authentication**

Frontend:

Firebase client authentication.

Backend:

Validate Firebase JWT / ID tokens in FastAPI.

---

# Database

Use:

**PostgreSQL**

The code must work with Supabase PostgreSQL through a normal database connection string.

---

# AI

Use:

**Gemini API**

Build one central AI service.

Do not scatter direct Gemini API calls throughout the application.

---

# ML

Use Python models for:

- demand forecasting
- stock-out prediction
- anomaly detection

Start simple and deterministic.

Improve later.

---

# Background Processing

Use:

- Celery
- Redis

Use Celery only where asynchronous processing makes sense.

Do not over-engineer simple CRUD operations.

---

# 5. HIGH-LEVEL PROJECT STRUCTURE

Create a clean monorepo:

```text
AarogyaGrid/
│
├── frontend/
│
├── backend/
│
├── ml/
│
├── database/
│
├── docs/
│
├── scripts/
│
├── tests/
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── .env.example
```

---

# 6. BACKEND STRUCTURE

Use approximately this architecture:

```text
backend/
│
├── app/
│   ├── main.py
│   │
│   ├── core/
│   │   ├── security.py
│   │   ├── dependencies.py
│   │   ├── exceptions.py
│   │   └── constants.py
│   │
│   ├── config/
│   │   └── settings.py
│   │
│   ├── db/
│   │   ├── session.py
│   │   ├── base.py
│   │   └── migrations/
│   │
│   ├── models/
│   ├── schemas/
│   │
│   ├── api/
│   │   ├── router.py
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── districts.py
│   │       ├── facilities.py
│   │       ├── medicines.py
│   │       ├── inventory.py
│   │       ├── consumption.py
│   │       ├── forecasts.py
│   │       ├── risks.py
│   │       ├── redistribution.py
│   │       ├── transfers.py
│   │       ├── warehouses.py
│   │       ├── expiry.py
│   │       ├── copilot.py
│   │       └── dashboard.py
│   │
│   ├── services/
│   │   ├── inventory_service.py
│   │   ├── forecasting_service.py
│   │   ├── risk_service.py
│   │   ├── redistribution_service.py
│   │   ├── transfer_service.py
│   │   ├── expiry_service.py
│   │   ├── warehouse_service.py
│   │   ├── ai_service.py
│   │   └── dashboard_service.py
│   │
│   ├── workers/
│   └── utils/
│
├── tests/
└── requirements.txt
```

Do not blindly create empty directories.

Only create them when they become relevant.

---

# 7. ML STRUCTURE

Use:

```text
ml/
│
├── models/
│   ├── demand_forecasting.py
│   ├── stockout_prediction.py
│   └── anomaly_detection.py
│
├── pipelines/
│   ├── training_pipeline.py
│   └── inference_pipeline.py
│
├── features/
│   ├── feature_builder.py
│   └── transformations.py
│
├── training/
│
├── evaluation/
│   └── metrics.py
│
└── artifacts/
```

Do NOT commit large generated model artifacts unless necessary.

---

# 8. CORE DATABASE MODEL

Design relational models properly.

Use UUID primary keys unless there is a strong reason not to.

All important entities must include:

```text
created_at
updated_at
```

when appropriate.

---

## District

Fields:

```text
id
name
state
status
created_at
updated_at
```

---

## Facility

Fields:

```text
id
district_id
name
facility_type
address
latitude
longitude
contact_number
status
created_at
updated_at
```

Possible types:

```text
PHC
CHC
DISTRICT_HOSPITAL
```

---

## Warehouse

Fields:

```text
id
district_id
name
address
latitude
longitude
status
created_at
updated_at
```

---

## User

Fields:

```text
id
firebase_uid
name
email
role
facility_id
district_id
status
created_at
updated_at
```

Possible roles:

```text
DISTRICT_ADMIN
FACILITY_ADMIN
HEALTHCARE_STAFF
WAREHOUSE_MANAGER
```

---

## Medicine Catalogue

Fields:

```text
id
name
generic_name
category
unit
manufacturer
created_at
updated_at
```

---

## Inventory Batch

Fields:

```text
id
facility_id
warehouse_id
medicine_id
batch_number
quantity
expiry_date
received_at
created_at
updated_at
```

A batch must belong to either:

- a healthcare facility

or

- a warehouse

Do not allow ambiguous ownership.

---

## Consumption Record

Fields:

```text
id
facility_id
medicine_id
date
quantity_consumed
patient_count
created_at
```

This entity is critical.

Demand forecasting depends on consumption history.

---

## Forecast

Fields:

```text
id
facility_id
medicine_id
forecast_date
forecast_horizon_days
predicted_demand
average_daily_demand
days_to_stockout
stockout_date
risk_score
confidence
model_version
generated_at
```

---

## Supply Risk

Fields:

```text
id
facility_id
medicine_id
risk_level
risk_score
days_to_stockout
reason
generated_at
```

Possible states:

```text
HEALTHY
AT_RISK
HIGH_RISK
CRITICAL
```

---

## Redistribution Recommendation

Fields:

```text
id
source_facility_id
destination_facility_id
source_warehouse_id
medicine_id
recommended_quantity
distance_km
score
priority
reason
estimated_days_restored
expiry_rescue_quantity
confidence
status
created_at
```

---

## Stock Transfer

Fields:

```text
id
recommendation_id
source_facility_id
destination_facility_id
source_warehouse_id
medicine_id
batch_id
quantity
status
requested_by
approved_by
requested_at
approved_at
dispatched_at
received_at
created_at
updated_at
```

Possible states:

```text
RECOMMENDED
PENDING
APPROVED
REJECTED
IN_TRANSIT
RECEIVED
CANCELLED
```

---

## Audit Log

Fields:

```text
id
user_id
facility_id
action
entity
entity_id
description
timestamp
```

---

# 9. SEED DATA

Create realistic synthetic hackathon data.

Do NOT use real patient data.

Seed approximately:

- 1 district
- 6 PHCs
- 2 CHCs
- 1 District Hospital
- 1 District Warehouse
- 15–25 medicines
- multiple batches per medicine
- 90–180 days of historical consumption
- several upcoming expiries
- several artificial shortage scenarios

Include intentional scenarios such as:

### Scenario A

PHC Sanand:

Amoxicillin stock-out in approximately 2–3 days.

CHC Bavla:

Amoxicillin surplus.

---

### Scenario B

PHC Rampura:

Insulin excess likely to expire.

Another facility:

Insulin shortage predicted.

---

### Scenario C

Warehouse replenishment required because no safe facility surplus exists.

These scenarios must make the demo predictable.

---

# 10. PHASED IMPLEMENTATION

Follow these phases EXACTLY.

---

# PHASE 0 — PROJECT FOUNDATION

Goal:

Create a clean development foundation.

Implement:

- monorepo structure
- frontend app
- backend app
- environment configuration
- database connection
- linting
- formatting
- `.env.example`
- README
- Docker setup where useful
- health-check API

Backend endpoint:

```text
GET /api/health
```

Expected:

```json
{
  "status": "ok",
  "service": "AarogyaGrid API"
}
```

Frontend should display a simple development landing screen.

DO NOT implement features yet.

### Completion Criteria

- frontend starts
- backend starts
- PostgreSQL connects
- API health endpoint works
- frontend can reach backend
- clean README exists

STOP after completion.

---

# PHASE 1 — DATABASE + CORE DOMAIN

Goal:

Build the operational foundation.

Implement:

- districts
- facilities
- warehouses
- users
- medicine catalogue
- inventory batches
- consumption records

Create:

- SQLAlchemy models
- Pydantic schemas
- repositories/services where useful
- migrations
- CRUD APIs
- database seed script

Required API groups:

```text
/api/districts
/api/facilities
/api/warehouses
/api/medicines
/api/inventory
/api/consumption
```

Add validation.

Examples:

- quantity cannot be negative
- expiry must be valid
- facility must exist
- medicine must exist

Seed realistic synthetic data.

### Frontend

Build basic pages:

```text
/dashboard
/facilities
/inventory
/consumption
```

The inventory page must support:

- facility filter
- medicine filter
- stock quantity
- batch
- expiry date
- status

### Completion Criteria

I must be able to:

1. view facilities
2. view warehouse
3. view inventory
4. add inventory
5. record consumption
6. inspect historical consumption

STOP after completion.

---

# PHASE 2 — AUTHENTICATION + RBAC

Goal:

Secure the operational system.

Implement Firebase Authentication.

Frontend:

- login
- logout
- authenticated routes

Backend:

- Firebase JWT validation
- current-user resolution
- role checks
- district/facility scope

Roles:

```text
DISTRICT_ADMIN
FACILITY_ADMIN
HEALTHCARE_STAFF
WAREHOUSE_MANAGER
```

Example permissions:

### District Admin

Can:

- see all facilities
- see district-wide inventory
- view risks
- approve transfers

### Facility Admin

Can:

- access own facility
- edit own inventory
- review transfers

### Healthcare Staff

Can:

- submit inventory updates
- submit consumption

### Warehouse Manager

Can:

- manage warehouse inventory
- process warehouse transfers

Add audit logging for important mutations.

### Completion Criteria

Verify that users cannot access unauthorised facilities.

STOP after completion.

---

# PHASE 3 — COMMAND CENTRE FOUNDATION

Goal:

Build the main operational UI before AI.

Create a polished healthcare command centre.

Dashboard KPIs:

```text
Total Facilities
Total Medicines
Low Stock Items
Expiring Soon
Critical Facilities
Pending Transfers
```

Build sections:

### District Overview

### Facility Health

### Inventory Summary

### Expiry Alerts

### Recent Activity

### Pending Actions

Use responsive charts where appropriate.

Do NOT fake predictive AI metrics yet.

Clearly label static low-stock calculations as:

```text
Current Stock Alerts
```

not:

```text
AI Predictions
```

### Completion Criteria

Dashboard must be fully driven by backend data.

STOP after completion.

---

# PHASE 4 — CONSUMPTION INTELLIGENCE

Goal:

Prepare data properly for forecasting.

Build:

- historical consumption aggregation
- daily demand calculation
- rolling averages
- weekly trends
- medicine-facility time series

Implement feature engineering.

Example features:

```text
lag_1
lag_7
lag_14
rolling_mean_7
rolling_mean_14
rolling_std_7
day_of_week
month
patient_count
current_stock
```

Build visualisations:

- consumption trend
- average daily demand
- recent demand change

Do NOT claim sophisticated forecasting yet.

### Completion Criteria

For any facility + medicine combination, the system should return a clean chronological consumption dataset ready for ML.

STOP after completion.

---

# PHASE 5 — DEMAND FORECASTING

Goal:

Implement real predictive demand forecasting.

Start with a baseline.

Compare at least:

### Baseline Model

Moving average / naive forecast.

### ML Model

XGBoost regression or another appropriate model.

Do NOT add Prophet simply because it appears in the proposal.

Use it only if it improves results or simplifies implementation.

Train using synthetic historical data.

Evaluate using metrics such as:

```text
MAE
RMSE
MAPE
```

Store model version and metrics.

API:

```text
POST /api/forecasts/generate

GET /api/forecasts

GET /api/forecasts/{facility_id}/{medicine_id}
```

Output should include:

```text
predicted demand
average daily demand
forecast horizon
confidence
model version
```

Frontend:

Create:

```text
/forecasts
```

Show:

- historical demand
- predicted demand
- confidence
- forecast horizon

### Completion Criteria

Forecasts must come from real model inference.

No hardcoded predictions.

STOP after completion.

---

# PHASE 6 — STOCK-OUT RISK ENGINE

Goal:

Turn forecasts into actionable risk.

Calculate:

```text
days_to_stockout
```

using:

```text
current usable stock
/
predicted daily demand
```

Improve calculation where necessary for future demand curves.

Determine risk level.

Suggested starting rules:

```text
CRITICAL
< 3 days

HIGH_RISK
3–7 days

AT_RISK
7–14 days

HEALTHY
> 14 days
```

Make thresholds configurable.

Consider:

- current stock
- predicted demand
- safety stock
- procurement lead time
- forecast confidence

Create API:

```text
GET /api/risks

GET /api/risks/critical

POST /api/risks/recalculate
```

Dashboard must now show:

```text
Critical Facilities
At-Risk Medicines
Stock-Out Predictions
```

Example:

```text
Amoxicillin 500 mg

Current Stock:
126

Predicted Stock-Out:
2 days 9 hours

Risk:
CRITICAL
```

### Completion Criteria

Changing consumption or stock should affect risk predictions.

STOP after completion.

---

# PHASE 7 — EXPIRY RESCUE ENGINE

Goal:

Predict medicine wastage.

For every inventory batch calculate:

```text
days_until_expiry
```

Estimate:

```text
expected_consumption_before_expiry
```

Then:

```text
potential_expiring_surplus =
quantity
-
expected_consumption_before_expiry
```

If positive:

mark as candidate for expiry rescue.

Prioritise appropriate FEFO behaviour:

**First Expiry, First Out**

Create APIs:

```text
GET /api/expiry/risks

GET /api/expiry/rescue-opportunities
```

Frontend page:

```text
/expiry-rescue
```

Display:

- facility
- medicine
- batch
- expiry date
- current quantity
- expected consumption
- rescueable surplus

### Completion Criteria

The Rampura-style excess medicine scenario must appear automatically.

STOP after completion.

---

# PHASE 8 — REDISTRIBUTION ENGINE
## CORE USP

Goal:

Automatically recommend how shortages can be resolved using network inventory.

When destination facility has shortage risk:

find candidate sources.

Candidate sources:

- PHC
- CHC
- District Hospital
- Warehouse

Calculate:

```text
safe_surplus =
source_stock
-
predicted_source_requirement
-
source_safety_stock
```

Reject source if:

```text
safe_surplus <= 0
```

Calculate geographic distance using coordinates.

Start with Haversine distance.

Google Maps can be added later.

---

## Candidate Scoring

Start with transparent scoring.

Example:

```text
score =
urgency_weight
+ surplus_weight
+ expiry_rescue_weight
+ impact_weight
- distance_penalty
- source_risk_penalty
```

Normalize inputs before combining.

Do NOT use arbitrary raw units directly.

Document the formula.

---

## Constraint Engine

Enforce:

1. Never reduce source below safety stock.
2. Never transfer expired medicine.
3. Never transfer more than destination requirement.
4. Prefer batches nearing expiry where medically/logistically appropriate.
5. Reject high-risk source facilities.
6. Require approval before stock changes.
7. Warehouse acts as fallback if safe facility surplus cannot satisfy demand.

---

## Ranking Engine

Return ranked recommendations.

Example:

```text
1. CHC Bavla
   quantity: 220
   distance: 8.4 km
   score: 0.91

2. District Warehouse
   quantity: 220
   distance: 43 km
   score: 0.63
```

API:

```text
POST /api/redistribution/generate

GET /api/redistribution/recommendations

GET /api/redistribution/{id}
```

Frontend:

```text
/redistribution
```

Show:

- risk
- recommended source
- destination
- quantity
- distance
- source surplus
- estimated coverage restored
- reason
- confidence

### Completion Criteria

The demo shortage scenario should automatically generate a sensible recommendation.

STOP after completion.

---

# PHASE 9 — HUMAN APPROVAL + STOCK TRANSFERS

Goal:

Create a real human-in-the-loop workflow.

Recommendation lifecycle:

```text
RECOMMENDED
    ↓
PENDING
    ↓
APPROVED
    ↓
IN_TRANSIT
    ↓
RECEIVED
```

Also support:

```text
REJECTED
CANCELLED
```

Create:

```text
/api/transfers
```

Actions:

```text
create
approve
reject
dispatch
receive
cancel
```

IMPORTANT:

Inventory must NOT update when the recommendation is merely generated.

Inventory should reconcile only when the transfer is confirmed received.

When received:

### Source

Subtract quantity.

### Destination

Add quantity.

Create audit records.

Protect against:

- duplicate receive action
- negative inventory
- concurrent modification problems

Use proper transactions.

### Completion Criteria

Complete an end-to-end transfer without manually editing inventory.

STOP after completion.

---

# PHASE 10 — GEMINI EXPLANATION LAYER

Goal:

Add generative AI without weakening system reliability.

Create:

```text
ai_service.py
```

Gemini receives structured facts such as:

```json
{
  "destination": "PHC Sanand",
  "medicine": "Amoxicillin 500 mg",
  "days_to_stockout": 2.4,
  "source": "CHC Bavla",
  "safe_surplus": 620,
  "recommended_quantity": 220,
  "distance_km": 8.4
}
```

Gemini produces:

- concise recommendation explanation
- risk explanation
- operational summary

It must NOT modify the recommendation.

Prompt Gemini to:

- never invent values
- use only supplied facts
- clearly state uncertainty
- avoid medical diagnosis

Example output:

```text
CHC Bavla is recommended because it has sufficient
predicted surplus to transfer 220 units while retaining
its own safety stock. At 8.4 km, it is also the closest
safe source for PHC Sanand.
```

### Completion Criteria

Recommendation explanations must reflect exact backend data.

STOP after completion.

---

# PHASE 11 — AI SUPPLY COPILOT

Goal:

Enable natural-language queries.

Frontend:

```text
/copilot
```

Example questions:

```text
Which facilities are critical this week?

Which medicines are likely to expire?

What transfers should I approve today?

Can current district surplus solve all ORS shortages?

Which facility has the highest medicine risk?
```

Architecture:

```text
User Query
   ↓
Intent Detection
   ↓
Backend Query / Tools
   ↓
Structured Result
   ↓
Gemini Explanation
```

Do NOT send the entire database into Gemini.

Implement deterministic backend retrieval.

Gemini should summarise retrieved facts.

### Completion Criteria

Copilot answers must correspond to actual database state.

STOP after completion.

---

# PHASE 12 — VOICE INVENTORY REPORTING

Goal:

Make frontline reporting easier.

Allow user to record/upload voice.

Example:

```text
Paracetamol 500 mg ke 240 tablets bache hain.
Aaj 37 use hue.
```

Convert to structured draft:

```json
{
  "medicine": "Paracetamol 500 mg",
  "remaining_stock": 240,
  "consumed_today": 37
}
```

IMPORTANT:

Do NOT directly save extracted values.

Flow:

```text
Voice
 ↓
Extraction
 ↓
Structured Draft
 ↓
Human Verification
 ↓
Submit
```

Support at minimum:

- English
- Hindi

Gujarati may be added if practical.

### Completion Criteria

Voice input must create a valid editable form.

STOP after completion.

---

# PHASE 13 — REGISTER IMAGE DIGITISATION

Goal:

Digitise paper inventory registers.

Allow image upload.

Extract:

```text
medicine
batch number
opening stock
received stock
consumed stock
closing stock
expiry date
```

Use Gemini multimodal capability if available.

Flow:

```text
Register Image
      ↓
AI Extraction
      ↓
Structured Draft
      ↓
User Verification
      ↓
Database Update
```

Never auto-save unverified extraction.

Store original image reference where appropriate.

### Completion Criteria

A sample medicine register image should populate an editable inventory form.

STOP after completion.

---

# PHASE 14 — GEOGRAPHIC NETWORK

Goal:

Visualise medicine resilience geographically.

Create map view.

Show facilities:

```text
Green = Healthy
Yellow = At Risk
Orange = High Risk
Red = Critical
Purple = Expiry / Overstock Opportunity
```

Display:

- facility
- medicine risks
- transfer recommendations
- source/destination routes

Initially use coordinates stored in database.

If Google Maps Platform credentials are available, integrate properly.

Otherwise keep the system provider-neutral and use a suitable map implementation for development.

### Completion Criteria

Clicking a facility should reveal inventory-risk information.

STOP after completion.

---

# PHASE 15 — HEALTH SUPPLY STRESS SIMULATOR

Goal:

Add what-if analysis.

Example:

```text
What happens if ORS demand increases by 30%?
```

or:

```text
Simulate dengue-related demand increase of 30%.
```

This simulator must NOT pretend to epidemiologically predict disease.

It simply modifies demand assumptions.

User provides:

```text
medicine/category
demand percentage increase
duration
facilities/district
```

System recalculates:

- demand
- stock-out risk
- vulnerable facilities
- redistribution requirements
- warehouse requirements

Display:

```text
Before Simulation
vs
After Simulation
```

### Completion Criteria

Changing demand must recalculate risks without altering production inventory.

STOP after completion.

---

# PHASE 16 — CELERY + BACKGROUND AUTOMATION

Goal:

Move expensive repetitive processes to background jobs.

Potential tasks:

```text
forecast regeneration
risk recalculation
expiry scans
recommendation generation
report generation
```

Use Celery + Redis.

Do NOT move every request into Celery.

Create retry handling.

Record failures.

### Completion Criteria

At least forecasting/risk recalculation runs asynchronously.

STOP after completion.

---

# PHASE 17 — IMPACT METRICS

Goal:

Measure value created by AarogyaGrid.

Add:

## Stock-Outs Prevented

Count shortages resolved before inventory reaches zero.

## Medicine Wastage Prevented

Track quantity rescued through redistribution.

## Inventory Coverage Restored

Example:

```text
+22 days
```

## Redistribution Efficiency

```text
shortages resolved through existing district inventory
/
total resolved shortages
```

## Emergency Procurement Avoided

Track cases where facility redistribution replaced warehouse procurement.

Dashboard cards:

```text
Stock-Outs Prevented

Medicine Units Rescued

Coverage Days Restored

Redistribution Success Rate
```

These metrics are critical for hackathon storytelling.

STOP after completion.

---

# PHASE 18 — UI/UX POLISH

Goal:

Make AarogyaGrid look like a credible healthcare operations platform.

Visual principles:

- clean
- modern
- calm
- professional
- data-focused
- responsive
- not overly futuristic
- not chatbot-centric

Primary dashboard should instantly communicate:

```text
What is critical?

Why is it critical?

What should I do?

What impact will the action create?
```

Prioritise:

### Critical Risks

### Recommended Actions

### Expiry Rescue

### Pending Approvals

### District Overview

Avoid unnecessary animations.

Avoid excessive gradients.

Avoid giant cards with little information.

Use strong information hierarchy.

STOP after completion.

---

# PHASE 19 — TESTING

Implement meaningful tests.

Backend:

- inventory
- consumption
- forecasting
- risk
- safe surplus
- redistribution constraints
- transfer approval
- receiving transfer
- expiry rescue
- RBAC

Critical unit test:

A source facility must NEVER be selected if the transfer pushes it below safety stock.

Critical integration test:

```text
Critical Shortage
   ↓
Recommendation
   ↓
Approval
   ↓
Transfer
   ↓
Receive
   ↓
Inventory Reconciliation
```

Frontend:

Test important flows.

Do not waste hackathon time targeting perfect test coverage.

Focus on core logic.

STOP after completion.

---

# PHASE 20 — DEMO PREPARATION

Create one controlled end-to-end story.

## Demo Scenario

PHC Sanand:

```text
Amoxicillin 500 mg

Current Stock:
126

Predicted Stock-Out:
2 days 9 hours

Risk:
CRITICAL
```

AarogyaGrid searches network.

Finds:

```text
CHC Bavla

Available:
1,420 units

Safe Surplus:
620

Distance:
8.4 km
```

Recommendation:

```text
Transfer 220 units
CHC Bavla
→
PHC Sanand
```

Gemini explains why.

Administrator approves.

Transfer moves to:

```text
APPROVED
↓
IN_TRANSIT
↓
RECEIVED
```

Inventory updates.

Dashboard changes:

```text
Stock-Out Prevented

22 Days Coverage Restored
```

Then demonstrate expiry rescue:

```text
PHC Rampura
Insulin excess
Likely expiry
```

AarogyaGrid finds another facility with predicted demand.

Generate redistribution.

The demo must communicate:

> We are not helping healthcare facilities manage shortages after they occur.

> AarogyaGrid predicts them and helps prevent them.

STOP after completion.

---

# PHASE 21 — DEPLOYMENT

Target deployment architecture:

```text
Next.js Frontend
        ↓
FastAPI Backend
        │
        ├── PostgreSQL / Supabase
        │
        ├── Redis
        │
        ├── Celery Workers
        │
        ├── ML Models
        │
        └── Gemini API
```

Deploy backend/worker services using:

**Google Cloud Run**, where practical.

Frontend may use:

- Vercel

or

- another compatible deployment

depending on project requirements.

Database:

Supabase PostgreSQL.

Use environment variables.

Never expose secrets.

Prepare:

```text
.env.example
```

Document deployment.

STOP after completion.

---

# 11. HACKATHON PRIORITY ORDER

If time becomes limited, prioritise in this exact order:

## P0 — MUST WORK

1. Inventory
2. Consumption tracking
3. Demand forecasting
4. Stock-out risk
5. Redistribution engine
6. Expiry rescue
7. Human approval
8. Inventory reconciliation
9. Command centre
10. Gemini explanations

---

## P1 — HIGH DEMO VALUE

11. AI Supply Copilot
12. Voice reporting
13. Register image extraction
14. Geographic network

---

## P2 — OPTIONAL

15. Stress simulator
16. Advanced anomaly detection
17. Advanced route optimisation
18. Complex Celery pipelines
19. advanced reports

Never sacrifice P0 reliability to implement P2 features.

---

# 12. REDISTRIBUTION ENGINE RULES

This is the most important engineering module.

Treat it carefully.

For destination `D`, medicine `M`, potential source `S`:

Calculate:

```text
destination_required_quantity
```

Calculate:

```text
source_safe_surplus =
current_source_stock
-
predicted_source_demand
-
source_safety_stock
```

Candidate is valid only if:

```text
source_safe_surplus > 0
```

Recommended quantity:

```text
min(
    destination_required_quantity,
    source_safe_surplus
)
```

Prefer:

1. safe source
2. shorter distance
3. near-expiry suitable inventory
4. sufficient quantity
5. lower source risk

Warehouse is fallback.

Never create unsafe transfer recommendations.

---

# 13. FORECASTING RULES

Start simple.

A reliable baseline is better than a fake complex model.

Always compare against naive forecasting.

Save evaluation metrics.

Do not show confidence unless it has meaningful interpretation.

Do not claim medical prediction.

You are forecasting:

**medicine consumption**

not:

**disease diagnosis.**

---

# 14. RESPONSIBLE AI REQUIREMENTS

AarogyaGrid must NOT:

- diagnose illnesses
- prescribe drugs
- suggest clinical treatment
- autonomously transfer medicines
- fabricate predictions
- hide uncertainty

AI outputs must remain advisory.

All important actions require human verification.

---

# 15. SECURITY REQUIREMENTS

Never commit:

- Firebase private keys
- Gemini API keys
- Supabase passwords
- JWT secrets
- Google credentials

Use environment variables.

Validate:

- authentication
- role
- facility scope
- request payload
- inventory quantity
- transfer state transition

---

# 16. CODE QUALITY

Follow these engineering standards:

- TypeScript strict mode
- Python type hints
- meaningful function names
- modular services
- no giant files
- no duplicated business logic
- no hardcoded database IDs
- no hardcoded prediction results
- no hardcoded demo values inside production logic
- environment-driven configuration
- proper error handling
- meaningful API responses

Avoid premature abstraction.

Avoid over-engineering.

---

# 17. API DESIGN

Use versioned endpoints:

```text
/api/v1/
```

Example:

```text
/api/v1/facilities
/api/v1/inventory
/api/v1/consumption
/api/v1/forecasts
/api/v1/risks
/api/v1/redistribution
/api/v1/transfers
/api/v1/expiry
/api/v1/copilot
/api/v1/dashboard
```

Use correct HTTP semantics.

---

# 18. FRONTEND ROUTES

Target:

```text
/login

/dashboard

/facilities

/inventory

/consumption

/forecasts

/risks

/redistribution

/transfers

/expiry-rescue

/warehouses

/copilot

/network

/simulation

/settings
```

Do not expose empty unfinished routes.

---

# 19. COMMAND CENTRE DESIGN

Main screen must prioritise:

```text
DISTRICT MEDICINE RESILIENCE

Critical Facilities

At-Risk Facilities

Expiry Risks

Stock-Outs Prevented
```

Then:

```text
IMMEDIATE INTERVENTION

PHC Sanand

Amoxicillin 500 mg

Stock-Out:
2 days 9 hours

Recommended:

CHC Bavla → PHC Sanand

220 units

8.4 km

[Review Transfer]
```

The user should immediately understand:

```text
Problem
↓
Recommendation
↓
Impact
↓
Action
```

---

# 20. IMPORTANT PRODUCT CONSTRAINT

Do NOT turn AarogyaGrid into:

- patient ERP
- appointment system
- telemedicine
- prescription software
- hospital billing
- ambulance booking
- doctor recommendation
- disease chatbot

Stay focused on:

# Medicine Supply Resilience

---

# 21. EXPECTED FINAL DEMO FLOW

The completed platform should support this workflow:

```text
Facility Input
      ↓
FastAPI Backend
      ↓
Data Processing
      ↓
Demand Forecast
      ↓
Stock-Out Risk
      ↓
Expiry Analysis
      ↓
Redistribution Recommendation
      ↓
Gemini Explanation
      ↓
Human Approval
      ↓
Stock Transfer
      ↓
Inventory Reconciliation
      ↓
Impact Measurement
```

---

# 22. FIRST TASK

Begin with:

# PHASE 0 — PROJECT FOUNDATION

Before writing code:

1. Inspect the current repository.
2. Do not overwrite useful existing work.
3. Report the current repository state.
4. Propose the exact Phase 0 file structure.
5. Identify environment variables required.
6. Then implement Phase 0.
7. Run the application.
8. Verify frontend-backend connectivity.
9. Report results.
10. STOP.

Do not begin Phase 1 until I explicitly approve it.