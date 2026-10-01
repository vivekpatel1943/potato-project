from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.db.session import get_async_db
from app.db.redis import get_redis
from app.features.auth.dependencies import get_current_admin
from app.features.admin.category_management import service
from app.features.admin.category_management import schemas

router = APIRouter(tags=["Admin - Category Management"])


@router.get("/categories", response_model=list[schemas.CategoryAdminOut])
async def get_categories(
    db: AsyncSession = Depends(get_async_db),
    _admin=Depends(get_current_admin),
):
    """List all categories and subcategories (active and inactive)."""
    return await service.get_all_categories_admin(db)


@router.post("/categories", response_model=schemas.CategoryAdminOut)
async def create_category(
    body: schemas.CreateCategoryRequest,
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """Create a new parent category."""
    category = await service.create_category(db, redis, body.name, body.description)
    return category


@router.post("/subcategories", response_model=schemas.SubcategoryAdminOut)
async def create_subcategory(
    body: schemas.CreateSubcategoryRequest,
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """Create a new subcategory."""
    subcategory = await service.create_subcategory(db, redis, body.category_id, body.name, body.description,body.keywords)
    return subcategory


@router.patch("/categories/{category_id}", response_model=schemas.CategoryAdminOut)
async def update_category(
    category_id: str,
    body: schemas.UpdateEntityRequest,
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """Update a parent category."""
    # We pass empty subcategories list to avoid lazy loading issues on the return schema
    # since we just need to return the updated parent info.
    category = await service.update_category(
        db, redis, category_id, body.is_active, body.name, body.description
    )
    category.subcategories = []
    return category


@router.patch("/subcategories/{subcategory_id}", response_model=schemas.SubcategoryAdminOut)
async def update_subcategory(
    subcategory_id: str,
    body: schemas.UpdateEntityRequest,
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
    _admin=Depends(get_current_admin),
):
    """Update a subcategory."""
    return await service.update_subcategory(
        db, redis, subcategory_id, body.is_active, body.name, body.description, body.keywords
    )
