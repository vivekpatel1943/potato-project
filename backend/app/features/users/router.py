from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_user
from app.features.users.models import User
from app.features.users.schemas import UserMeOut
from app.features.workers.models import WorkerProfile

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserMeOut)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Return the authenticated user's current profile."""
    # Fast check for worker profile existence
    result = await db.execute(select(WorkerProfile.user_id).where(WorkerProfile.user_id == user.id))
    has_worker_profile = result.scalar_one_or_none() is not None

    return UserMeOut(
        id=user.id,
        email=user.email,
        user_name=user.user_name,
        phone=user.phone,
        role=user.role.value,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_phone_verified=user.is_phone_verified,
        has_worker_profile=has_worker_profile,
    )
