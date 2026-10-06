from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, Text
from sqlalchemy.orm import selectinload
from redis.asyncio import Redis

from app.features.categories.models import Category, Subcategory
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


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def search_subcategories(db: AsyncSession, query: str, limit: int = 15) -> list[dict]:
    """Search active subcategories by name, parent category name, or keyword.

    Case-insensitive partial match. `keywords` is a JSONB array, so we match
    against its text form — e.g. "biry" matches ["biryani", "pulao"].
    Results are ranked: exact name > name prefix > name contains > keyword/category hit.
    """
    q = query.strip().lower()
    if not q:
        return []

    pattern = f"%{_escape_like(q)}%"

    result = await db.execute(
        select(Subcategory, Category.name)
        .join(Category, Subcategory.category_id == Category.id)
        .where(
            Subcategory.is_active == True,
            Category.is_active == True,
            or_(
                Subcategory.name.ilike(pattern, escape="\\"),
                Category.name.ilike(pattern, escape="\\"),
                cast(Subcategory.keywords, Text).ilike(pattern, escape="\\"),
            ),
        )
        .limit(100)
    )

    def rank(sub: Subcategory) -> int:
        name = sub.name.lower()
        if name == q:
            return 0
        if name.startswith(q):
            return 1
        if q in name:
            return 2
        if any(q == (k or "").lower() for k in (sub.keywords or [])):
            return 3
        return 4

    rows = sorted(result.all(), key=lambda r: (rank(r[0]), r[0].name))

    return [
        {
            "id": sub.id,
            "name": sub.name,
            "description": sub.description,
            "keywords": sub.keywords or [],
            "category_id": sub.category_id,
            "category_name": category_name,
        }
        for sub, category_name in rows[:limit]
    ]
