from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.db.session import get_async_db
from app.db.redis import get_redis
from app.core.config import Settings
from app.features.auth import service
from app.features.auth.schemas import OTPRequest, OTPVerify, TokenResponse, RefreshRequest
from app.shared.rate_limit import check_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])

settings = Settings()


@router.post("/request-otp")
async def request_otp(
    body: OTPRequest,
    request: Request,
    redis: Redis = Depends(get_redis),
):
    """Send a one-time password to the user's email."""
    await check_rate_limit(
        redis, request, prefix="otp", cooldown_seconds=settings.otp_rate_limit_seconds
    )
    await service.request_otp(email=body.email, redis=redis, settings=settings)
    return {"message": "If this email is valid, you will receive an OTP shortly."}


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    body: OTPVerify,
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Verify OTP and return access/refresh tokens."""
    return await service.verify_otp(
        db=db, redis=redis, email=body.email, otp_code=body.otp_code, settings=settings
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_async_db),
):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    return await service.refresh_tokens(
        db=db, refresh_token=body.refresh_token, settings=settings
    )
