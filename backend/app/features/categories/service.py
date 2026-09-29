from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from redis.asyncio import Redis

from app.features.categories.models import Category
from app.shared.cache import cache_key, get_cached, set_cached

CATEGORIES_KEY = cache_key("categories", "all")
CATEGORIES_TTL = 3600  # 1 hour


async def get_all_categories(db: AsyncSession, redis: Redis | None = None) -> list:
    """Fetch all categories with their subcategories eager-loaded.
    Uses Redis cache when available.
    """

    # Try cache first
    if redis:
        cached = await get_cached(redis, CATEGORIES_KEY)
        if cached:
            return cached

    # Cache miss — query DB
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)
        .options(
            selectinload(Category.subcategories.and_(Category.subcategories.property.mapper.class_.is_active == True))
        )
        .order_by(Category.name)
    )
    categories = list(result.scalars().all())

    # Store in cache
    if redis:
        cache_data = [
            {
                "id": str(cat.id),
                "name": cat.name,
                "description": cat.description,
                "subcategories": [
                    {"id": str(sub.id), "name": sub.name, "description": sub.description}
                    for sub in cat.subcategories
                ],
            }
            for cat in categories
        ]
        await set_cached(redis, CATEGORIES_KEY, cache_data, CATEGORIES_TTL)

    return categories
