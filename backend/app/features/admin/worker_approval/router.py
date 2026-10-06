import uuid
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_admin
from app.features.users.models import User
from app.features.admin.worker_approval import service
from app.features.admin.worker_approval.schemas import (
    PendingWorkerRow,
    WorkerFullDetail,
    ApprovalAction,
    ApprovalResult,
)

router = APIRouter(tags=["Admin - Worker Approval"])


@router.get("/workers/pending", response_model=list[PendingWorkerRow])
async def list_pending(
    db: AsyncSession = Depends(get_async_db),
    _admin: User = Depends(get_current_admin),
):
    """List all workers awaiting approval."""
    return await service.list_pending_workers(db)


@router.get("/workers/{worker_id}", response_model=WorkerFullDetail)
async def get_worker_detail(
    worker_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    _admin: User = Depends(get_current_admin),
):
    """Full detail view for a single worker."""
    return await service.get_worker_full_detail(db, worker_id)


@router.post("/workers/{worker_id}/approve", response_model=ApprovalResult)
async def approve(
    worker_id: uuid.UUID,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    admin: User = Depends(get_current_admin),
):
    """Approve a worker's profile. Sends them a push notification."""
    return await service.approve_worker(db, background, admin, worker_id)


@router.post("/workers/{worker_id}/reject", response_model=ApprovalResult)
async def reject(
    worker_id: uuid.UUID,
    body: ApprovalAction,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    admin: User = Depends(get_current_admin),
):
    """Reject a worker's profile with an optional reason."""
    return await service.reject_worker(db, background, admin, worker_id, body.reason)
