from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_user
from app.features.users.models import User
from app.features.workers.schemas import (
    WorkerProfileCreate,
    WorkerProfileUpdate,
    WorkerProfileOut,
    AvailabilityUpdate,
    PresignedUrlRequest,
    PresignedUrlResponse,
    PresignedGetRequest,
    PresignedGetResponse,
    DraftSaveRequest,
    DraftResponse,
    DeleteUploadRequest,
    CapabilityOut,
    WorkerPublicCardOut,
)
from app.features.workers.service import (
    create_worker_profile,
    update_worker_profile,
    get_worker_profile,
    toggle_availability,
    generate_presigned_upload_url,
    generate_presigned_get_url,
    upsert_onboarding_draft,
    get_onboarding_draft,
    delete_upload_from_r2,
    get_public_workers,
)

router = APIRouter(prefix="/workers", tags=["Workers"])

@router.get("/", response_model=list[WorkerPublicCardOut])
async def get_browse_workers(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_async_db)
):
    """Get a list of all public, verified, and available workers with pagination."""
    return await get_public_workers(db, skip, limit)


# ── Presigned Upload URL ──────────────────────────────────────────────────


@router.post("/upload-url", response_model=PresignedUrlResponse)
async def get_upload_url(
    body: PresignedUrlRequest,
    user: User = Depends(get_current_user),
):
    """Generate a presigned URL for the frontend to upload directly to R2."""
    upload_url, file_url = generate_presigned_upload_url(
        file_name=body.file_name,
        content_type=body.content_type,
        bucket_type=body.bucket_type,
    )
    return PresignedUrlResponse(upload_url=upload_url, file_url=file_url)


@router.post("/download-url", response_model=PresignedGetResponse)
async def get_download_url(
    body: PresignedGetRequest,
    user: User = Depends(get_current_user),
):
    """Generate a presigned GET URL for a private file."""
    download_url = generate_presigned_get_url(body.file_url)
    return PresignedGetResponse(download_url=download_url)


@router.delete("/upload")
async def delete_upload(
    body: DeleteUploadRequest,
    user: User = Depends(get_current_user),
):
    """Delete a previously uploaded file from R2 (cleanup on replace/remove)."""
    success = delete_upload_from_r2(
        file_url=body.file_url,
        bucket_type=body.bucket_type,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete the uploaded file.",
        )
    return {"detail": "File deleted successfully."}


# ── Onboarding Draft ──────────────────────────────────────────────────────


@router.get("/onboarding/draft", response_model=DraftResponse)
async def get_draft(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Fetch the user's in-progress onboarding draft."""
    draft = await get_onboarding_draft(db, user.id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No onboarding draft found.",
        )
    return draft


@router.put("/onboarding/draft", response_model=DraftResponse)
async def save_draft(
    body: DraftSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Save or update the user's onboarding draft after each step."""
    draft = await upsert_onboarding_draft(
        db,
        user_id=user.id,
        current_step=body.current_step,
        draft_data=body.draft_data,
    )
    return draft


# ── Worker Profile ────────────────────────────────────────────────────────


@router.post("/profile", response_model=WorkerProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: WorkerProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Create a new worker profile. Requires phone verification."""
    profile = await create_worker_profile(db, user, body)

    # Build the response with subcategory names
    return _build_profile_response(profile)


@router.put("/profile", response_model=WorkerProfileOut)
async def update_profile(
    body: WorkerProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Update an existing worker profile."""
    profile = await update_worker_profile(db, user, body)
    return _build_profile_response(profile)


@router.get("/me", response_model=WorkerProfileOut)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Get the authenticated worker's own profile."""
    profile = await get_worker_profile(db, user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker profile not found. Create one first.",
        )

    return _build_profile_response(profile)


@router.patch("/me/availability", response_model=WorkerProfileOut)
async def update_availability(
    body: AvailabilityUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Toggle the worker's availability status."""
    await toggle_availability(db, user.id, body.is_available)
    profile = await get_worker_profile(db, user.id)
    return _build_profile_response(profile)


# ── Helpers ───────────────────────────────────────────────────────────────


def _build_profile_response(profile) -> WorkerProfileOut:
    """Map the ORM model to the response schema, injecting subcategory names."""
    capabilities = []
    for cap in profile.capabilities:
        capabilities.append(
            CapabilityOut(
                id=cap.id,
                subcategory_id=cap.subcategory_id,
                subcategory_name=cap.subcategory.name if cap.subcategory else None,
                proofs=cap.proofs,
            )
        )

    return WorkerProfileOut(
        user_id=profile.user_id,
        avatar_url=profile.avatar_url,
        is_available=profile.is_available,
        verification_status=profile.verification_status,
        capabilities=capabilities,
        verification_documents=profile.verification_documents,
    )
