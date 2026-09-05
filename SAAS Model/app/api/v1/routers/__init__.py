from fastapi import APIRouter

from app.api.v1.routers.dashboard import router as dashboard_router
from app.api.v1.routers.demo import router as demo_router
from app.api.v1.routers.health import router as health_router
from app.api.v1.routers.integrations import router as integrations_router
from app.api.v1.routers.interview import router as interview_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(integrations_router)
api_router.include_router(interview_router)
api_router.include_router(dashboard_router)
api_router.include_router(demo_router)
