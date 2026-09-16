import secrets
from urllib.parse import quote

from redis.asyncio import Redis
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.users.models import User
from app.core.config import Settings


async def request_phone_verification(
    user: User,
    phone: str,
    redis: Redis,
    settings: Settings,
) -> dict:
    """Generate a verification code, store in Redis, and return a wa.me deep link.

    The wa.me link opens the user's WhatsApp with a pre-filled message containing
    the code. They just press "Send" to the business number. The bot (or manual
    fallback) then calls confirm_phone_verification.
    """
    # Generate a 6-digit verification code
    code = "".join(
        str(secrets.randbelow(10)) for _ in range(settings.phone_verify_code_length)
    )

    # Store in Redis: key = "phone_verify:{user_id}", value = "{phone}:{code}"
    redis_key = f"phone_verify:{user.id}"
    redis_value = f"{phone}:{code}"
    await redis.setex(redis_key, settings.phone_verify_expiry_seconds, redis_value)

    # Build the wa.me deep link
    # Format: https://wa.me/<number>?text=<pre-filled message>
    pre_filled_message = f"POTATO-{code}"
    whatsapp_link = (
        f"https://wa.me/{settings.whatsapp_verify_number}"
        f"?text={quote(pre_filled_message)}"
    )

    return {
        "whatsapp_link": whatsapp_link,
        "message": "Click the link to verify via WhatsApp, or enter the code manually.",
    }


async def confirm_phone_verification(
    user: User,
    phone: str,
    code: str,
    db: AsyncSession,
    redis: Redis,
) -> dict:
    """Validate the verification code and mark the user's phone as verified."""
    redis_key = f"phone_verify:{user.id}"
    stored_value = await redis.get(redis_key)

    if not stored_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending phone verification. Please request a new code.",
        )

    # stored_value = "{phone}:{code}"
    stored_phone, stored_code = stored_value.rsplit(":", 1)

    if stored_phone != phone or stored_code != code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or verification code.",
        )

    # Code is valid — delete it and update user
    await redis.delete(redis_key)

    user.phone = phone
    user.is_phone_verified = True
    await db.commit()

    return {
        "verified": True,
        "phone": phone,
    }
