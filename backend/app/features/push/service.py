import asyncio
import json
import logging
import uuid
from typing import Iterable

from pywebpush import webpush, WebPushException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import AsyncSessionLocal
from app.features.push.models import PushSubscription

logger = logging.getLogger(__name__)
settings = Settings()


# ── Subscription CRUD ─────────────────────────────────────────────────────


async def upsert_subscription(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
    p256dh_key: str,
    auth_key: str,
    user_agent: str | None,
) -> PushSubscription:
    """Store a browser subscription. Endpoints are globally unique, so if the
    same browser re-subscribes (or a different user logs in on it) we just
    re-point the row to the current user."""
    result = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    sub = result.scalars().first()

    if sub:
        sub.user_id = user_id
        sub.p256dh_key = p256dh_key
        sub.auth_key = auth_key
        sub.user_agent = user_agent
    else:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            user_agent=user_agent,
        )
        db.add(sub)

    await db.commit()
    await db.refresh(sub)
    return sub


async def delete_subscription(db: AsyncSession, user_id: uuid.UUID, endpoint: str) -> None:
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == endpoint,
            PushSubscription.user_id == user_id,
        )
    )
    await db.commit()


# ── Sending ───────────────────────────────────────────────────────────────


def _send_one(sub_info: dict, data: str) -> int | None:
    """Blocking webpush call. Returns an HTTP status code on failure, None on success."""
    try:
        webpush(
            subscription_info=sub_info,
            data=data,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_claim_email},
            ttl=60 * 60,  # push service keeps it for 1h if device is offline
        )
        return None
    except WebPushException as e:
        code = e.response.status_code if e.response is not None else -1
        logger.warning("Web push failed (%s): %s", code, e)
        return code
    except Exception:  # network errors etc. must never break the caller
        logger.exception("Unexpected web push error")
        return -1


async def send_push_to_users(user_ids: Iterable[uuid.UUID], payload: dict) -> None:
    """Send a push notification to every device of every given user.

    Opens its own DB session so it can safely run as a FastAPI BackgroundTask
    (the request's session is closed by then). Never raises.
    """
    ids = list({uid for uid in user_ids if uid})
    if not ids:
        return

    if not settings.vapid_private_key:
        logger.warning("VAPID keys not configured — skipping push to %d user(s)", len(ids))
        return

    data = json.dumps(payload)

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(PushSubscription).where(PushSubscription.user_id.in_(ids)))
            subs = list(result.scalars().all())
            if not subs:
                return

            # pywebpush is synchronous (uses `requests`) → run in threads concurrently
            codes = await asyncio.gather(*[
                asyncio.to_thread(
                    _send_one,
                    {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh_key, "auth": s.auth_key}},
                    data,
                )
                for s in subs
            ])

            # 404/410 → subscription expired or revoked; clean it up
            dead = [s.id for s, code in zip(subs, codes) if code in (404, 410)]
            if dead:
                await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(dead)))
                await db.commit()
    except Exception:
        logger.exception("Failed to dispatch push notifications")


async def send_push_to_user(user_id: uuid.UUID, payload: dict) -> None:
    await send_push_to_users([user_id], payload)
