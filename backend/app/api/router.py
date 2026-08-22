from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.domain import router as domain_router
from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.consumption_intelligence import router as consumption_intelligence_router
from app.api.routes.forecasts import router as forecasts_router
from app.api.routes.risks import router as risks_router
from app.api.routes.expiry import router as expiry_router
from app.api.routes.redistribution import router as redistribution_router
from app.api.routes.transfers import router as transfers_router
from app.api.routes.ai import router as ai_router
from app.api.routes.voice import router as voice_router
from app.api.routes.register import router as register_router
from app.api.routes.map import router as map_router
from app.api.routes.simulation import router as simulation_router
from app.api.routes.reports import router as reports_router
from app.api.routes.seed import router as seed_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router, tags=["system"])
api_router.include_router(domain_router, tags=["core domain"])
api_router.include_router(auth_router, prefix="/users", tags=["auth"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(consumption_intelligence_router, prefix="/consumption-intelligence", tags=["consumption intelligence"])
api_router.include_router(forecasts_router, prefix="/forecasts", tags=["demand forecasts"])
api_router.include_router(risks_router, prefix="/risks", tags=["stockout risks"])
api_router.include_router(expiry_router, prefix="/expiry", tags=["expiry rescue"])
api_router.include_router(redistribution_router, prefix="/redistribution", tags=["redistribution engine"])
api_router.include_router(transfers_router, prefix="/transfers", tags=["stock transfers"])
api_router.include_router(ai_router, prefix="/ai", tags=["gemini ai explanation"])
api_router.include_router(voice_router, prefix="/voice", tags=["voice reporting"])
api_router.include_router(register_router, prefix="/register", tags=["register digitisation"])
api_router.include_router(map_router, prefix="/map", tags=["geographic network map"])
api_router.include_router(simulation_router, prefix="/simulations", tags=["health supply stress simulator"])
api_router.include_router(reports_router, prefix="/reports", tags=["government reports and exports"])
api_router.include_router(seed_router, prefix="/demo", tags=["demo seed data"])











