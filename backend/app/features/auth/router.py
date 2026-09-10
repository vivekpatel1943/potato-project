from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.db.session import get_async_db
from app.db.redis import get_redis
from app.core.config import Settings
from app.features.auth import service
from app.features.auth.schemas import OTPRequest, OTPVerify, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])

settings = Settings()


@router.post("/request-otp")
async def request_otp(
    body: OTPRequest,
    redis: Redis = Depends(get_redis),
):
    """Send a one-time password to the user's email."""
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
