import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import get_redis
from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_user
from app.features.tasks import service
from app.features.tasks.schemas import (
    ApplicationOut,
    ApplyRequest,
    MyApplicationOut,
    ReopenResult,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.features.users.models import User

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# NOTE: static paths (/mine, /available, /applications/mine) are declared
# before /{task_id} so they aren't swallowed by the path parameter.


# ── Customer ──────────────────────────────────────────────────────────────


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Create a task, run the matching engine, and push-notify eligible workers."""
    return await service.create_task(db, redis, background, user, body)


@router.get("/mine", response_model=list[TaskOut])
async def my_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await service.list_my_tasks(db, user)


# ── Worker (static paths) ─────────────────────────────────────────────────


@router.get("/available", response_model=list[TaskOut])
async def available_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Nearby open tasks the worker is qualified for and hasn't applied to."""
    return await service.list_available_tasks(db, redis, user)


@router.get("/applications/mine", response_model=list[MyApplicationOut])
async def my_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await service.list_my_applications(db, user)


# ── Single task ───────────────────────────────────────────────────────────


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    return await service.get_task_detail(db, redis, user, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
async def edit_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Owner edits an OPEN task (e.g. after a worker cancelled)."""
    return await service.update_task(db, user, task_id, body)


@router.post("/{task_id}/cancel", response_model=TaskOut)
async def cancel_task(
    task_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Owner cancels the task."""
    return await service.cancel_task(db, background, user, task_id)


@router.post("/{task_id}/reopen-notify", response_model=ReopenResult)
async def reopen_notify(
    task_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """After a worker cancelled: clear NOT_SELECTED/CANCELLED applications and re-notify workers."""
    task, notified = await service.reopen_and_notify(db, redis, background, user, task_id)
    return ReopenResult(task=task, notified_workers=notified)


@router.get("/{task_id}/applications", response_model=list[ApplicationOut])
async def task_applications(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await service.list_applications(db, user, task_id)


@router.post("/{task_id}/approve/{application_id}", response_model=TaskOut)
async def approve(
    task_id: uuid.UUID,
    application_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await service.approve_application(db, background, user, task_id, application_id)


@router.post("/{task_id}/reject/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reject(
    task_id: uuid.UUID,
    application_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    await service.reject_application(db, background, user, task_id, application_id)


# ── Worker actions on a task ──────────────────────────────────────────────


@router.post("/{task_id}/apply", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def apply(
    task_id: uuid.UUID,
    body: ApplyRequest,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    return await service.apply_to_task(db, redis, background, user, task_id, body)


@router.post("/{task_id}/withdraw", response_model=TaskOut)
async def withdraw(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    return await service.withdraw_application(db, redis, user, task_id)


@router.post("/{task_id}/cancel-assignment", response_model=TaskOut)
async def cancel_assignment(
    task_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis),
):
    """Assigned worker backs out → task reopens, customer is notified."""
    return await service.worker_cancel_assignment(db, redis, background, user, task_id)
