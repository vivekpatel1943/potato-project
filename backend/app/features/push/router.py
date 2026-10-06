from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_user
from app.features.users.models import User
from app.features.push.schemas import PushSubscribeRequest, PushUnsubscribeRequest, VapidPublicKeyOut
from app.features.push.service import upsert_subscription, delete_subscription

settings = Settings()

router = APIRouter(prefix="/push", tags=["Push"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyOut)
async def get_vapid_public_key():
    """Public VAPID key the browser needs to create a push subscription."""
    return VapidPublicKeyOut(public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    body: PushSubscribeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    await upsert_subscription(
        db,
        user_id=user.id,
        endpoint=body.endpoint,
        p256dh_key=body.p256dh_key,
        auth_key=body.auth_key,
        user_agent=request.headers.get("user-agent"),
    )
    return {"detail": "Subscribed."}


@router.delete("/subscribe")
async def unsubscribe(
    body: PushUnsubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    await delete_subscription(db, user.id, body.endpoint)
    return {"detail": "Unsubscribed."}
