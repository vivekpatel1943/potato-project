import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from redis.asyncio import Redis

from app.features.categories.models import Category, Subcategory
from app.shared.cache import delete_cached, cache_key

# The key used by the public categories endpoint
CATEGORIES_KEY = cache_key("categories", "all")


async def flush_categories_cache(redis: Redis | None):
    """Invalidate the public categories cache."""
    if redis:
        await delete_cached(redis, CATEGORIES_KEY)


async def get_all_categories_admin(db: AsyncSession) -> list[Category]:
    """Fetch ALL categories and subcategories, including inactive ones."""
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.subcategories))
        .order_by(Category.name)
    )
    return list(result.scalars().all())


async def update_category(
    db: AsyncSession, 
    redis: Redis | None, 
    category_id: str, 
    is_active: bool | None = None,
    name: str | None = None,
    description: str | None = None
) -> Category:
    result = await db.execute(select(Category).where(Category.id == uuid.UUID(category_id)))
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    
    if name is not None and name != category.name:
        dup = await db.execute(select(Category).where(Category.name == name))
        if dup.scalars().first():
            raise HTTPException(status_code=400, detail="Category with this name already exists.")
        category.name = name

    if description is not None:
        category.description = description
        
    if is_active is not None:
        category.is_active = is_active
        
    await db.commit()
    await flush_categories_cache(redis)
    return category


async def update_subcategory(
    db: AsyncSession, 
    redis: Redis | None, 
    subcategory_id: str, 
    is_active: bool | None = None,
    name: str | None = None,
    description: str | None = None
) -> Subcategory:
    result = await db.execute(select(Subcategory).where(Subcategory.id == uuid.UUID(subcategory_id)))
    subcategory = result.scalars().first()
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found.")
    
    if name is not None and name != subcategory.name:
        dup = await db.execute(
            select(Subcategory)
            .where(Subcategory.category_id == subcategory.category_id, Subcategory.name == name)
        )
        if dup.scalars().first():
            raise HTTPException(status_code=400, detail="Subcategory with this name already exists in this category.")
        subcategory.name = name

    if description is not None:
        subcategory.description = description
        
    if is_active is not None:
        subcategory.is_active = is_active

    await db.commit()
    await flush_categories_cache(redis)
    return subcategory


async def create_category(db: AsyncSession, redis: Redis | None, name: str, description: str | None) -> Category:
    # Check for duplicates
    result = await db.execute(select(Category).where(Category.name == name))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Category with this name already exists.")
        
    category = Category(name=name, description=description, is_active=True)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    
    # Eager load empty subcategories list so the response schema parses correctly
    category.subcategories = []
    
    await flush_categories_cache(redis)
    return category


async def create_subcategory(db: AsyncSession, redis: Redis | None, category_id: str, name: str, description: str | None) -> Subcategory:
    # Ensure parent exists
    result = await db.execute(select(Category).where(Category.id == uuid.UUID(category_id)))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Parent category not found.")
        
    # Check for duplicates in same parent
    sub_result = await db.execute(select(Subcategory).where(Subcategory.category_id == uuid.UUID(category_id), Subcategory.name == name))
    if sub_result.scalars().first():
        raise HTTPException(status_code=400, detail="Subcategory with this name already exists in this category.")
        
    subcategory = Subcategory(category_id=uuid.UUID(category_id), name=name, description=description, is_active=True)
    db.add(subcategory)
    await db.commit()
    await db.refresh(subcategory)
    
    await flush_categories_cache(redis)
    return subcategory
