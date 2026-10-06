from fastapi import APIRouter

from app.features.admin.role_management.router import router as role_router
from app.features.admin.caches.router import router as caches_router
from app.features.admin.category_management.router import router as category_router
from app.features.admin.worker_approval.router import router as approval_router
from app.features.admin.search_analytics.router import router as analytics_router

router = APIRouter(prefix="/admin", tags=["Admin"])

router.include_router(role_router)
router.include_router(caches_router)
router.include_router(category_router)
router.include_router(approval_router)
router.include_router(analytics_router)
