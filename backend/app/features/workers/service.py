import logging
import uuid
from urllib.parse import urlparse

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.features.users.models import User
from app.features.workers.models import (
    WorkerProfile,
    WorkerCapability,
    WorkerCapabilityProof,
    WorkerVerificationDocument,
    WorkerOnboardingDraft,
)
from app.features.workers.schemas import WorkerProfileCreate, CapabilityProofCreate

logger = logging.getLogger(__name__)

settings = Settings()

# ── R2 Client ──────────────────────────────────────────────────────────────

_s3_client = None


def _get_s3_client():
    """Lazy-initialise the S3-compatible client for Cloudflare R2."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=BotoConfig(signature_version="s3v4"),
            region_name="auto",
        )
    return _s3_client


# ── Presigned URL ──────────────────────────────────────────────────────────


def generate_presigned_upload_url(
    file_name: str,
    content_type: str,
    bucket_type: str = "public",
) -> tuple[str, str]:
    """
    Generate a presigned PUT URL for direct browser → R2 upload.

    Returns (upload_url, final_public_url).
    """
    s3 = _get_s3_client()
    bucket = (
        settings.r2_public_bucket
        if bucket_type == "public"
        else settings.r2_private_bucket
    )

    # Create a unique key to prevent collisions
    unique_key = f"{uuid.uuid4().hex[:8]}_{file_name}"
    object_key = f"uploads/{unique_key}"

    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=600,  # 10 minutes
    )

    # Build the final accessible URL
    if bucket_type == "public":
        file_url = f"{settings.r2_potato_public_base_url}/{object_key}"
    else:
        # Private files are not publicly accessible; store the key so the
        # backend can generate temporary signed GET URLs later
        file_url = f"r2://{bucket}/{object_key}"

    return upload_url, file_url

# generating presigned get urls , to preview the doc uploaded by the user , 
def generate_presigned_get_url(file_url: str) -> str:
    """Generate a temporary presigned GET URL for a private R2 object."""
    if not file_url.startswith("r2://"):
        return file_url

    s3 = _get_s3_client()
    without_scheme = file_url[len("r2://"):]
    bucket = without_scheme.split("/", 1)[0]
    object_key = without_scheme.split("/", 1)[1]

    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=3600,  # Valid for 1 hour
    )


def delete_upload_from_r2(file_url: str, bucket_type: str = "public") -> bool:
    """
    Delete an object from R2 given its stored URL.

    Handles both formats:
      - Public:  https://<domain>/uploads/<key>
      - Private: r2://<bucket>/uploads/<key>

    Returns True if deleted (or already gone), False on error.
    """
    s3 = _get_s3_client()

    try:
        if file_url.startswith("r2://"):
            # r2://bucket-name/uploads/abc123_file.jpg
            without_scheme = file_url[len("r2://"):]
            bucket = without_scheme.split("/", 1)[0]
            object_key = without_scheme.split("/", 1)[1]
        else:
            # https://pub-xxx.r2.dev/uploads/abc123_file.jpg
            parsed = urlparse(file_url)
            object_key = parsed.path.lstrip("/")
            bucket = (
                settings.r2_public_bucket
                if bucket_type == "public"
                else settings.r2_private_bucket
            )

        s3.delete_object(Bucket=bucket, Key=object_key)
        return True
    except ClientError:
        logger.warning("Failed to delete R2 object: %s", file_url, exc_info=True)
        return False


# ── Onboarding Draft ──────────────────────────────────────────────────────


async def upsert_onboarding_draft(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_step: int,
    draft_data: dict,
) -> WorkerOnboardingDraft:
    """Insert or update the user's onboarding draft."""
    draft = await db.get(WorkerOnboardingDraft, user_id)
    if draft:
        draft.current_step = current_step
        draft.draft_data = draft_data
    else:
        draft = WorkerOnboardingDraft(
            user_id=user_id,
            current_step=current_step,
            draft_data=draft_data,
        )
        db.add(draft)

    await db.commit()
    await db.refresh(draft)
    return draft


async def get_onboarding_draft(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> WorkerOnboardingDraft | None:
    """Fetch the user's onboarding draft if it exists."""
    return await db.get(WorkerOnboardingDraft, user_id)


async def delete_onboarding_draft(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    """Delete the user's onboarding draft."""
    await db.execute(
        sa_delete(WorkerOnboardingDraft)
        .where(WorkerOnboardingDraft.user_id == user_id)
    )
    await db.commit()


# ── Worker Profile CRUD ───────────────────────────────────────────────────


async def create_worker_profile(
    db: AsyncSession,
    user: User,
    data: WorkerProfileCreate,
) -> WorkerProfile:
    """Create a full worker profile with capabilities and verification docs in one transaction."""

    # Guard: one profile per user
    existing = await db.get(WorkerProfile, user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Worker profile already exists.",
        )

    # Guard: phone must be verified
    if not user.is_phone_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone verification is required before creating a worker profile.",
        )

    # 1. Create the profile
    profile = WorkerProfile(
        user_id=user.id,
        avatar_url=data.avatar_url,
        is_available=False,  # must be toggled on manually
    )
    db.add(profile)

    # 2. Create capabilities (one per selected subcategory)
    for sub_id in data.subcategory_ids:
        capability = WorkerCapability(
            worker_id=user.id,
            subcategory_id=sub_id,
        )
        db.add(capability)
        await db.flush()  # get capability.id for proofs

        # Attach proofs if provided for this subcategory
        proofs_for_sub: list[CapabilityProofCreate] = data.proofs.get(sub_id, [])
        for proof_data in proofs_for_sub:
            proof = WorkerCapabilityProof(
                worker_capability_id=capability.id,
                proof_type=proof_data.proof_type,
                url=proof_data.url,
                title=proof_data.title,
                description=proof_data.description,
            )
            db.add(proof)

    # 3. Create verification documents
    for doc_data in data.verification_documents:
        doc = WorkerVerificationDocument(
            worker_id=user.id,
            document_type=doc_data.document_type,
            document_url=doc_data.document_url,
            document_number=doc_data.document_number,
        )
        db.add(doc)

    await db.commit()
    await db.refresh(profile)

    # Clean up the onboarding draft now that the real profile exists
    await delete_onboarding_draft(db, user.id)

    # Re-fetch with relationships eager-loaded for the response
    return await get_worker_profile(db, user.id)


async def get_worker_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> WorkerProfile | None:
    """Fetch a worker profile with all relationships eager-loaded."""
    result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.user_id == user_id)
        .options(
            selectinload(WorkerProfile.capabilities).selectinload(
                WorkerCapability.proofs
            ),
            selectinload(WorkerProfile.capabilities).selectinload(
                WorkerCapability.subcategory
            ),
            selectinload(WorkerProfile.verification_documents),
        )
    )
    return result.scalars().first()


async def toggle_availability(
    db: AsyncSession,
    user_id: uuid.UUID,
    is_available: bool,
) -> WorkerProfile:
    """Toggle the worker's availability status."""
    profile = await db.get(WorkerProfile, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker profile not found.",
        )

    profile.is_available = is_available
    await db.commit()
    await db.refresh(profile)
    return profile
