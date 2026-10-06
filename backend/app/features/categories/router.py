from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.db.session import get_async_db
from app.db.redis import get_redis
from app.features.categories.schemas import CategoryOut, SubcategorySearchOut
from app.features.categories.service import get_all_categories, search_subcategories

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Public endpoint — returns all categories with nested subcategories."""
    return await get_all_categories(db, redis)


@router.get("/search", response_model=list[SubcategorySearchOut])
async def search_services(
    q: str = Query(..., min_length=1, max_length=100),
    db: AsyncSession = Depends(get_async_db),
):
    """Keyword search over subcategories (name, category name, keywords)."""
    return await search_subcategories(db, q)
