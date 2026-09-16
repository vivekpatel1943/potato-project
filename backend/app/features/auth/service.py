import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import aiosmtplib
from email.message import EmailMessage
import jwt
from redis.asyncio import Redis
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.features.users.models import User
from app.core.config import Settings

settings = Settings()

OTP_EXPIRY_SECONDS = settings.OTP_EXPIRY_SECONDS
OTP_LENGTH = settings.OTP_LENGTH


# ── OTP Generation & Delivery ──────────────────────────────────────────────

async def request_otp(email: str, redis: Redis, settings: Settings) -> None:
    """Generate a 6-digit OTP, save it in Redis, and send it via ZeptoMail."""

    # 1. Generate a cryptographically secure 6-digit OTP
    otp_code = "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))

    # 2. Store in Redis with TTL  (key = "otp:<email>")
    await redis.setex(f"otp:{email}", OTP_EXPIRY_SECONDS, otp_code)

    # 3. Send via SMTP
    message = EmailMessage()
    message["From"] = settings.smtp_from_address
    message["To"] = email
    message["Subject"] = "Your Potato Project Login Code"
    
    html_content = (
        f"<div style='font-family: sans-serif;'>"
        f"<h2>Your one-time code</h2>"
        f"<p style='font-size: 32px; letter-spacing: 8px; font-weight: bold;'>{otp_code}</p>"
        f"<p>This code expires in 5 minutes. Do not share it with anyone.</p>"
        f"</div>"
    )
    message.set_content(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=False,
            start_tls=True,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email.",
        )


# ── Username Generation ────────────────────────────────────────────────────

async def _generate_username(db: AsyncSession, email: str) -> str:
    """Derive a unique username from the email prefix.

    Strategy: strip the domain, keep only [a-z0-9_], then check uniqueness.
    On collision, append a random 4-digit suffix.
    """
    base = email.split("@")[0].lower()
    # Strip non-alphanumeric chars except underscores
    base = re.sub(r'[^a-z0-9_]', '', base)
    if not base:
        base = "user"

    # Check if base username is available
    result = await db.execute(select(User).where(User.user_name == base))
    if not result.scalars().first():
        return base

    # Append random 4-digit suffix until unique
    for _ in range(10):
        candidate = f"{base}_{secrets.randbelow(10000):04d}"
        result = await db.execute(select(User).where(User.user_name == candidate))
        if not result.scalars().first():
            return candidate

    # Fallback: UUID-based (virtually impossible to collide)
    return f"{base}_{uuid.uuid4().hex[:8]}"


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
        user_name = await _generate_username(db, email)
        user = User(email=email, user_name=user_name, is_email_verified=True)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.is_email_verified:
        user.is_email_verified = True
        await db.commit()

    # Issue tokens
    access_token = _create_token(
        data={"sub": str(user.id), "role": user.role.value},
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
        "user_name": user.user_name,
    }


# ── JWT Helpers ─────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_delta: timedelta, settings: Settings) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


# ── Token Refresh ───────────────────────────────────────────────────────────

async def refresh_tokens(
    db: AsyncSession, refresh_token: str, settings: Settings
) -> dict:
    """Validate a refresh token and issue a fresh access + refresh pair."""
    try:
        payload = jwt.decode(
            refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalars().first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    access_token = _create_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        settings=settings,
    )
    new_refresh_token = _create_token(
        data={"sub": str(user.id), "type": "refresh"},
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        settings=settings,
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "is_new_user": False,
        "user_name": user.user_name,
    }

