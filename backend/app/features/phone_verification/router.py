from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.db.session import get_async_db
from app.db.redis import get_redis
from app.core.config import Settings
from app.features.auth.dependencies import get_current_user
from app.features.users.models import User
from app.features.phone_verification import service
from app.features.phone_verification.schemas import (
    PhoneVerifyRequest,
    PhoneVerifyResponse,
    PhoneConfirmRequest,
    PhoneConfirmResponse,
)
from app.shared.rate_limit import check_rate_limit

router = APIRouter(prefix="/phone", tags=["phone-verification"])

settings = Settings()


@router.post("/request-verification", response_model=PhoneVerifyResponse)
async def request_verification(
    body: PhoneVerifyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    """Start phone verification — returns a WhatsApp deep link."""
    await check_rate_limit(
        redis, request, prefix="phone_verify", cooldown_seconds=settings.phone_rate_limit_seconds
    )
    return await service.request_phone_verification(
        user=user, phone=body.phone, redis=redis, settings=settings
    )


@router.post("/confirm-verification", response_model=PhoneConfirmResponse)
async def confirm_verification(
    body: PhoneConfirmRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Confirm phone verification with the code sent via WhatsApp."""
    return await service.confirm_phone_verification(
        user=user, phone=body.phone, code=body.code, db=db, redis=redis
    )
