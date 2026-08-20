# Phase 0 architecture

The frontend communicates with FastAPI through the environment-configured `NEXT_PUBLIC_API_BASE_URL`. FastAPI uses `DATABASE_URL`, allowing normal PostgreSQL or Supabase-compatible PostgreSQL connection strings. Docker Compose provides a local PostgreSQL 16 service for development.

Domain models, migrations, authentication, and business APIs begin in later phases.
