from fastapi import APIRouter

from app.features.admin.role_management.router import router as role_router
from app.features.admin.caches.router import router as caches_router

router = APIRouter(prefix="/admin", tags=["Admin"])

router.include_router(role_router)
router.include_router(caches_router)
