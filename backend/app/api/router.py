from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.domain import router as domain_router
from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.consumption_intelligence import router as consumption_intelligence_router
from app.api.routes.forecasts import router as forecasts_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router, tags=["system"])
api_router.include_router(domain_router, tags=["core domain"])
api_router.include_router(auth_router, prefix="/users", tags=["auth"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(consumption_intelligence_router, prefix="/consumption-intelligence", tags=["consumption intelligence"])
api_router.include_router(forecasts_router, prefix="/forecasts", tags=["demand forecasts"])

