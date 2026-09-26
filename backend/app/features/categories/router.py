from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.db.session import get_async_db
from app.db.redis import get_redis
from app.features.categories.schemas import CategoryOut
from app.features.categories.service import get_all_categories

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Public endpoint — returns all categories with nested subcategories."""
    return await get_all_categories(db, redis)
