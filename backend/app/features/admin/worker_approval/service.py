import uuid

from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.features.users.models import User
from app.features.workers.models import (
    WorkerProfile,
    WorkerCapability,
)
from app.features.workers.enums import VerificationStatus
from app.features.workers.service import generate_presigned_get_url
from app.features.push.service import send_push_to_user


async def list_pending_workers(db: AsyncSession) -> list[dict]:
    """Return all workers whose verification_status is PENDING, joined with User."""
    stmt = (
        select(WorkerProfile, User)
        .join(User, WorkerProfile.user_id == User.id)
        .where(WorkerProfile.verification_status == VerificationStatus.PENDING)
        .order_by(WorkerProfile.created_at.asc())   # oldest first
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "user_id": profile.user_id,
            "user_name": user.user_name,
            "email": user.email,
            "phone": user.phone,
            "avatar_url": profile.avatar_url,
            "verification_status": profile.verification_status,
            "created_at": profile.created_at,
        }
        for profile, user in rows
    ]


def _resolve_preview(url: str) -> str | None:
    """If the URL is a private r2:// reference, generate a temporary presigned GET URL."""
    if url.startswith("r2://"):
        return generate_presigned_get_url(url)
    return url   # public URLs are already accessible


async def get_worker_full_detail(db: AsyncSession, worker_id: uuid.UUID) -> dict:
    """Fetch every piece of data the admin needs to review a worker."""
    result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.user_id == worker_id)
        .options(
            selectinload(WorkerProfile.capabilities)
                .selectinload(WorkerCapability.proofs),
            selectinload(WorkerProfile.capabilities)
                .selectinload(WorkerCapability.subcategory),
            selectinload(WorkerProfile.verification_documents),
        )
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")

    user = await db.get(User, worker_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Build documents with presigned preview URLs
    documents = [
        {
            "id": doc.id,
            "document_type": doc.document_type,
            "document_url": doc.document_url,
            "document_number": doc.document_number,
            "preview_url": _resolve_preview(doc.document_url),
        }
        for doc in profile.verification_documents
    ]

    # Build capabilities with proof preview URLs
    capabilities = []
    for cap in profile.capabilities:
        proofs = [
            {
                "id": p.id,
                "proof_type": p.proof_type,
                "url": p.url,
                "preview_url": _resolve_preview(p.url),
                "title": p.title,
                "description": p.description,
            }
            for p in cap.proofs
        ]
        capabilities.append({
            "id": cap.id,
            "subcategory_id": cap.subcategory_id,
            "subcategory_name": cap.subcategory.name if cap.subcategory else None,
            "proofs": proofs,
        })

    return {
        "user_id": profile.user_id,
        "user_name": user.user_name,
        "email": user.email,
        "phone": user.phone,
        "avatar_url": profile.avatar_url,
        "verification_status": profile.verification_status,
        "verified_by": profile.verified_by,
        "is_available": profile.is_available,
        "created_at": profile.created_at,
        "verification_documents": documents,
        "capabilities": capabilities,
    }


async def approve_worker(
    db: AsyncSession, background: BackgroundTasks, admin: User, worker_id: uuid.UUID
) -> dict:
    profile = await db.get(WorkerProfile, worker_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")
    if profile.verification_status == VerificationStatus.VERIFIED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already verified.")

    profile.verification_status = VerificationStatus.VERIFIED
    profile.verified_by = admin.id
    await db.commit()

    # Push notification to worker
    background.add_task(
        send_push_to_user,
        worker_id,
        {
            "title": "✅ Profile approved!",
            "body": "You can now go online and start receiving tasks.",
            "url": "/profile",
        },
    )

    return {
        "user_id": worker_id,
        "verification_status": VerificationStatus.VERIFIED,
        "message": "Worker approved successfully.",
    }


async def reject_worker(
    db: AsyncSession, background: BackgroundTasks, admin: User, worker_id: uuid.UUID, reason: str | None
) -> dict:
    profile = await db.get(WorkerProfile, worker_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")
    if profile.verification_status == VerificationStatus.REJECTED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already rejected.")

    profile.verification_status = VerificationStatus.REJECTED
    profile.verified_by = admin.id
    await db.commit()

    body = "Your profile needs changes before approval."
    if reason:
        body = f"Reason: {reason}"

    background.add_task(
        send_push_to_user,
        worker_id,
        {
            "title": "❌ Profile not approved",
            "body": body,
            "url": "/profile",
        },
    )

    return {
        "user_id": worker_id,
        "verification_status": VerificationStatus.REJECTED,
        "message": "Worker rejected.",
    }
