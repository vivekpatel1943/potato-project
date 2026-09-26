from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from app.db.redis import get_redis
from app.features.auth.dependencies import get_current_admin
from app.features.admin.caches import service

router = APIRouter(tags=["Admin - Caches"])


@router.get("/caches")
async def list_caches(
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """List all application cache keys."""
    caches = await service.list_all_caches(redis)
    return {"caches": caches}


@router.delete("/caches/{cache_key:path}")
async def flush_cache(
    cache_key: str,
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """Flush a specific cache by key."""
    deleted = await service.flush_single_cache(redis, cache_key)
    return {"deleted": deleted, "key": cache_key}


@router.delete("/caches")
async def flush_all(
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """Flush ALL application caches."""
    count = await service.flush_all(redis)
    return {"deleted_count": count}
