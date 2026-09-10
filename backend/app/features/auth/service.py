import secrets
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from redis.asyncio import Redis
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.features.users.models import User
from app.core.config import Settings

OTP_EXPIRY_SECONDS = Settings.OTP_EXPIRY_SECONDS
OTP_LENGTH = Settings.OTP_LENGTH


# ── OTP Generation & Delivery ──────────────────────────────────────────────

async def request_otp(email: str, redis: Redis, settings: Settings) -> None:
    """Generate a 6-digit OTP, save it in Redis, and send it via ZeptoMail."""

    # 1. Generate a cryptographically secure 6-digit OTP
    otp_code = "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))

    # 2. Store in Redis with TTL  (key = "otp:<email>")
    await redis.setex(f"otp:{email}", OTP_EXPIRY_SECONDS, otp_code)

    # 3. Send via Zoho ZeptoMail
    url = "https://api.zeptomail.com/v1.1/email"
    headers = {
        "Authorization": f"Zoho-enczapikey {settings.zeptomail_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "from": {"address": settings.zeptomail_from_address},
        "to": [{"email_address": {"address": email}}],
        "subject": "Your Potato Project Login Code",
        "htmlbody": (
            f"<div style='font-family: sans-serif;'>"
            f"<h2>Your one-time code</h2>"
            f"<p style='font-size: 32px; letter-spacing: 8px; font-weight: bold;'>{otp_code}</p>"
            f"<p>This code expires in 5 minutes. Do not share it with anyone.</p>"
            f"</div>"
        ),
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email.",
            )


# ── OTP Verification & User Resolution ─────────────────────────────────────

async def verify_otp(
    db: AsyncSession, redis: Redis, email: str, otp_code: str, settings: Settings
) -> dict:
    """
    Verify the OTP against Redis.
    If valid → find or create the user → issue JWT tokens.
    """
    redis_key = f"otp:{email}"
    stored_otp = await redis.get(redis_key)

    if not stored_otp or stored_otp != otp_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP.",
        )

    # OTP is valid — delete it immediately so it can't be reused
    await redis.delete(redis_key)

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    is_new_user = False
    if not user:
        is_new_user = True
        user = User(email=email, is_email_verified=True)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.is_email_verified:
        user.is_email_verified = True
        await db.commit()

    # Issue tokens
    access_token = _create_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        settings=settings,
    )
    refresh_token = _create_token(
        data={"sub": str(user.id), "type": "refresh"},
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        settings=settings,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
    }


# ── JWT Helpers ─────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_delta: timedelta, settings: Settings) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
