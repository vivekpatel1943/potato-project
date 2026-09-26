from fastapi import APIRouter, Depends

from app.features.auth.dependencies import get_current_user
from app.features.users.models import User
from app.features.users.schemas import UserMeOut

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserMeOut)
async def get_me(user: User = Depends(get_current_user)):
    """Return the authenticated user's current profile."""
    return UserMeOut(
        id=user.id,
        email=user.email,
        user_name=user.user_name,
        phone=user.phone,
        role=user.role.value,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_phone_verified=user.is_phone_verified,
    )
