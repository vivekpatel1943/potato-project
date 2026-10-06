"""Task workflow service.

Lifecycle:
    OPEN ──approve──▶ ASSIGNED ──worker cancels──▶ OPEN (reopened) ──reopen-notify──▶ workers re-notified
      │                   │
      │                   └──customer cancels──▶ CANCELLED
      ├──customer cancels──▶ CANCELLED
      └──scheduled_at passes (lazy check)──▶ EXPIRED

All push notifications are dispatched via FastAPI BackgroundTasks *after*
the DB transaction commits, so a slow push service never blocks a response.
"""
import uuid
from datetime import datetime, timezone

from fastapi import BackgroundTasks, HTTPException, status
from geoalchemy2 import WKTElement
from redis.asyncio import Redis
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.features.categories.models import Subcategory
from app.features.push.service import send_push_to_users
from app.features.tasks.enums import TaskStatus, ApplicationStatus
from app.features.tasks.matching import (
    find_eligible_workers,
    get_worker_point,
    make_point,
    search_radius_meters,
)
from app.features.tasks.models import Task, TaskApplication
from app.features.tasks.schemas import (
    ApplicationOut,
    ApplyRequest,
    MyApplicationOut,
    MyApplicationSummary,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.features.users.models import User
from app.features.workers.enums import VerificationStatus
from app.features.workers.models import WorkerProfile, WorkerCapability


# ── Helpers ───────────────────────────────────────────────────────────────


def _point(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _task_query():
    """SELECT Task + its lat/lng, with display relationships eager-loaded."""
    return (
        select(
            Task,
            func.ST_Y(Task.location).label("lat"),
            func.ST_X(Task.location).label("lng"),
        )
        .options(
            selectinload(Task.subcategory).selectinload(Subcategory.category),
            selectinload(Task.customer),
            selectinload(Task.assigned_worker),
        )
        .execution_options(populate_existing=True)
    )


def _task_out(task: Task, lat: float, lng: float, **extra) -> TaskOut:
    sub = task.subcategory
    return TaskOut(
        id=task.id,
        customer_id=task.customer_id,
        customer_name=task.customer.user_name if task.customer else None,
        subcategory_id=task.subcategory_id,
        subcategory_name=sub.name if sub else None,
        category_name=sub.category.name if sub and sub.category else None,
        description=task.description,
        scheduled_at=task.scheduled_at,
        latitude=float(lat),
        longitude=float(lng),
        address=task.address,
        budget=task.budget,
        specific_requirements=task.specific_requirements,
        status=task.status,
        assigned_worker_id=task.assigned_worker_id,
        assigned_worker_name=task.assigned_worker.user_name if task.assigned_worker else None,
        assigned_at=task.assigned_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        **extra,
    )


async def _load_task(db: AsyncSession, task_id: uuid.UUID) -> tuple[Task, float, float]:
    row = (await db.execute(_task_query().where(Task.id == task_id))).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return row[0], row.lat, row.lng


async def _lock_task(db: AsyncSession, task_id: uuid.UUID) -> Task:
    """SELECT ... FOR UPDATE on the task row — serialises concurrent state changes."""
    task = (
        await db.execute(select(Task).where(Task.id == task_id).with_for_update())
    ).scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return task


def _require_owner(task: Task, user: User) -> None:
    if task.customer_id != user.id:
        # 404 rather than 403 so we don't leak which task IDs exist
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")


async def _owner_extras(db: AsyncSession, task_id: uuid.UUID) -> dict:
    counts = dict(
        (
            await db.execute(
                select(TaskApplication.status, func.count())
                .where(TaskApplication.task_id == task_id)
                .group_by(TaskApplication.status)
            )
        ).all()
    )
    return {
        "is_owner": True,
        "pending_applications": counts.get(ApplicationStatus.PENDING, 0),
        "worker_cancelled": counts.get(ApplicationStatus.CANCELLED, 0) > 0,
    }


async def _require_worker(db: AsyncSession, user: User, *, must_be_online: bool) -> WorkerProfile:
    profile = await db.get(WorkerProfile, user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You need a worker profile.")
    if profile.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your worker profile is not verified yet.")
    if must_be_online and not profile.is_available:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Go online to apply for tasks.")
    return profile


def _push(background: BackgroundTasks, user_ids, title: str, body: str, url: str, tag: str | None = None):
    ids = [u for u in user_ids if u]
    if ids:
        background.add_task(send_push_to_users, ids, {"title": title, "body": body, "url": url, "tag": tag})


def _money(value) -> str:
    return f"₹{value:,.0f}"


# ── Expiry (Option A — lazy, checked on access) ───────────────────────────


async def expire_stale_tasks(db: AsyncSession) -> None:
    """Mark OPEN tasks whose scheduled time has passed as EXPIRED."""
    result = await db.execute(
        update(Task)
        .where(Task.status == TaskStatus.OPEN, Task.scheduled_at < func.now())
        .values(status=TaskStatus.EXPIRED)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount:
        await db.commit()


# ── Matching + broadcast ──────────────────────────────────────────────────


async def _broadcast_task(
    db: AsyncSession,
    redis: Redis,
    background: BackgroundTasks,
    task: Task,
    *,
    title: str,
    extra_worker_ids: set[uuid.UUID] | None = None,
    exclude_worker_ids: set[uuid.UUID] | None = None,
) -> int:
    eligible = await find_eligible_workers(db, redis, task)
    ids = {e["worker_id"] for e in eligible} | (extra_worker_ids or set())
    ids -= exclude_worker_ids or set()
    ids.discard(task.customer_id)

    sub = await db.get(Subcategory, task.subcategory_id)
    when = task.scheduled_at.astimezone(timezone.utc).strftime("%b %d")
    _push(
        background,
        ids,
        title=title,
        body=f"{sub.name if sub else 'Task'} · {_money(task.budget)} · {when}",
        url=f"/tasks/{task.id}",
        tag=f"task-{task.id}",
    )
    return len(ids)


# ── Customer: create / read / edit / cancel ───────────────────────────────

async def create_task(
    db: AsyncSession, redis: Redis, background: BackgroundTasks, user: User, data: TaskCreate
) -> TaskOut:
    if not user.is_phone_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify your phone number to post tasks.")

    sub = await db.get(Subcategory, data.subcategory_id)
    if not sub or not sub.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected service is not available.")

    if data.scheduled_at <= _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scheduled time must be in the future.")

    task = Task(
        customer_id=user.id,
        subcategory_id=data.subcategory_id,
        description=data.description.strip(),
        scheduled_at=data.scheduled_at,
        location=_point(data.latitude, data.longitude),
        address=data.address,
        budget=data.budget,
        specific_requirements=data.specific_requirements,
        status=TaskStatus.OPEN,
    )
    db.add(task)
    await db.commit()

    await _broadcast_task(db, redis, background, task, title="🆕 New task nearby!")

    task, lat, lng = await _load_task(db, task.id)
    return _task_out(task, lat, lng, **(await _owner_extras(db, task.id)))


async def list_my_tasks(db: AsyncSession, user: User) -> list[TaskOut]:
    await expire_stale_tasks(db)
    rows = (
        await db.execute(_task_query().where(Task.customer_id == user.id).order_by(Task.created_at.desc()))
    ).all()
    if not rows:
        return []

    # One grouped query for all application counts
    task_ids = [r[0].id for r in rows]
    count_rows = (
        await db.execute(
            select(TaskApplication.task_id, TaskApplication.status, func.count())
            .where(TaskApplication.task_id.in_(task_ids))
            .group_by(TaskApplication.task_id, TaskApplication.status)
        )
    ).all()
    counts: dict[uuid.UUID, dict] = {}
    for tid, st, n in count_rows:
        counts.setdefault(tid, {})[st] = n

    out = []
    for task, lat, lng in rows:
        c = counts.get(task.id, {})
        out.append(_task_out(
            task, lat, lng,
            is_owner=True,
            pending_applications=c.get(ApplicationStatus.PENDING, 0),
            worker_cancelled=c.get(ApplicationStatus.CANCELLED, 0) > 0,
        ))
    return out


async def get_task_detail(db: AsyncSession, redis: Redis, user: User, task_id: uuid.UUID) -> TaskOut:
    await expire_stale_tasks(db)
    task, lat, lng = await _load_task(db, task_id)

    if task.customer_id == user.id:
        return _task_out(task, lat, lng, **(await _owner_extras(db, task.id)))

    my_app = (
        await db.execute(
            select(TaskApplication).where(
                TaskApplication.task_id == task.id, TaskApplication.worker_id == user.id
            )
        )
    ).scalars().first()

    # Non-owners can see OPEN tasks, or any task they applied to / are assigned to
    if task.status != TaskStatus.OPEN and not my_app and task.assigned_worker_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    distance_km = None
    point = await get_worker_point(db, redis, user.id)
    if point:
        worker_geog = func.geography(make_point(point[0], point[1]))
        d = (
            await db.execute(
                select(func.ST_Distance(func.geography(Task.location), worker_geog)).where(Task.id == task.id)
            )
        ).scalar()
        distance_km = round(float(d) / 1000, 1) if d is not None else None

    return _task_out(
        task, lat, lng,
        distance_km=distance_km,
        my_application=MyApplicationSummary(
            id=my_app.id,
            status=my_app.status,
            message=my_app.message,
            proposed_budget=my_app.proposed_budget,
            created_at=my_app.created_at,
        ) if my_app else None,
    )


async def update_task(db: AsyncSession, user: User, task_id: uuid.UUID, data: TaskUpdate) -> TaskOut:
    await expire_stale_tasks(db)
    task = await _lock_task(db, task_id)
    _require_owner(task, user)

    if task.status != TaskStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only open tasks can be edited.")

    fields = data.model_dump(exclude_unset=True)

    if "scheduled_at" in fields and fields["scheduled_at"] is not None:
        if fields["scheduled_at"] <= _now():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scheduled time must be in the future.")
        task.scheduled_at = fields["scheduled_at"]

    lat, lng = fields.get("latitude"), fields.get("longitude")
    if (lat is None) != (lng is None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide both latitude and longitude.")
    if lat is not None:
        task.location = _point(lat, lng)

    for key in ("description", "budget"):
        if fields.get(key) is not None:
            setattr(task, key, fields[key].strip() if key == "description" else fields[key])
    for key in ("address", "specific_requirements"):  # nullable — allow clearing
        if key in fields:
            setattr(task, key, fields[key])

    await db.commit()
    task, lat, lng = await _load_task(db, task_id)
    return _task_out(task, lat, lng, **(await _owner_extras(db, task.id)))


async def cancel_task(
    db: AsyncSession, background: BackgroundTasks, user: User, task_id: uuid.UUID
) -> TaskOut:
    """Customer cancels their own task (while OPEN or ASSIGNED)."""
    task = await _lock_task(db, task_id)
    _require_owner(task, user)

    if task.status not in (TaskStatus.OPEN, TaskStatus.ASSIGNED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This task can no longer be cancelled.")

    affected = (
        await db.execute(
            select(TaskApplication.worker_id).where(
                TaskApplication.task_id == task_id,
                TaskApplication.status.in_([ApplicationStatus.PENDING, ApplicationStatus.APPROVED]),
            )
        )
    ).scalars().all()

    await db.execute(
        update(TaskApplication)
        .where(TaskApplication.task_id == task_id, TaskApplication.status == ApplicationStatus.PENDING)
        .values(status=ApplicationStatus.NOT_SELECTED)
        .execution_options(synchronize_session=False)
    )
    task.status = TaskStatus.CANCELLED
    await db.commit()

    _push(background, affected, "Task cancelled", "The customer cancelled a task you applied to.", f"/tasks/{task_id}")

    task, lat, lng = await _load_task(db, task_id)
    return _task_out(task, lat, lng, **(await _owner_extras(db, task.id)))


# ── Customer: review applications ─────────────────────────────────────────


async def list_applications(db: AsyncSession, user: User, task_id: uuid.UUID) -> list[ApplicationOut]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    _require_owner(task, user)

    rows = (
        await db.execute(
            select(TaskApplication, User.user_name, WorkerProfile.avatar_url)
            .join(User, User.id == TaskApplication.worker_id)
            .outerjoin(WorkerProfile, WorkerProfile.user_id == TaskApplication.worker_id)
            .where(
                TaskApplication.task_id == task_id,
                TaskApplication.status != ApplicationStatus.WITHDRAWN,  # withdrawn apps disappear
            )
            .order_by(TaskApplication.created_at.asc())
        )
    ).all()

    order = {
        ApplicationStatus.APPROVED: 0,
        ApplicationStatus.PENDING: 1,
        ApplicationStatus.CANCELLED: 2,
        ApplicationStatus.NOT_SELECTED: 3,
        ApplicationStatus.REJECTED: 4,
    }
    rows = sorted(rows, key=lambda r: order.get(r[0].status, 9))

    return [
        ApplicationOut(
            id=app.id,
            task_id=app.task_id,
            worker_id=app.worker_id,
            worker_name=name,
            worker_avatar_url=avatar,
            status=app.status,
            message=app.message,
            proposed_budget=app.proposed_budget,
            distance_km=float(app.distance_km) if app.distance_km is not None else None,
            created_at=app.created_at,
        )
        for app, name, avatar in rows
    ]


async def reject_application(
    db: AsyncSession, background: BackgroundTasks, user: User, task_id: uuid.UUID, application_id: uuid.UUID
) -> None:
    task = await _lock_task(db, task_id)
    _require_owner(task, user)
    if task.status != TaskStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task is no longer open.")

    app = (
        await db.execute(
            select(TaskApplication).where(
                TaskApplication.id == application_id,
                TaskApplication.task_id == task_id,
                TaskApplication.status == ApplicationStatus.PENDING,
            )
        )
    ).scalars().first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found or already processed.")

    app.status = ApplicationStatus.REJECTED
    worker_id = app.worker_id
    await db.commit()

    sub = await db.get(Subcategory, task.subcategory_id)
    _push(
        background, [worker_id],
        "Application declined",
        f"Your application for {sub.name if sub else 'a task'} was declined.",
        "/my-jobs",
    )


async def approve_application(
    db: AsyncSession, background: BackgroundTasks, user: User, task_id: uuid.UUID, application_id: uuid.UUID
) -> TaskOut:
    """Approve exactly one worker.

    The task row is locked with SELECT ... FOR UPDATE, so a double-tap or two
    open tabs can never approve two workers: the second request waits for the
    lock, then sees status=ASSIGNED and gets a 409.
    """
    await expire_stale_tasks(db)

    # 1. Lock the task row
    task = await _lock_task(db, task_id)
    _require_owner(task, user)
    if task.status != TaskStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task is no longer open for applications.")

    # 2. The application being approved
    app = (
        await db.execute(
            select(TaskApplication).where(
                TaskApplication.id == application_id,
                TaskApplication.task_id == task_id,
                TaskApplication.status == ApplicationStatus.PENDING,
            )
        )
    ).scalars().first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found or already processed.")

    # 3. Remaining PENDING applicants → NOT_SELECTED (REJECTED / WITHDRAWN keep their status)
    not_selected_ids = (
        await db.execute(
            select(TaskApplication.worker_id).where(
                TaskApplication.task_id == task_id,
                TaskApplication.id != application_id,
                TaskApplication.status == ApplicationStatus.PENDING,
            )
        )
    ).scalars().all()

    app.status = ApplicationStatus.APPROVED
    await db.execute(
        update(TaskApplication)
        .where(
            TaskApplication.task_id == task_id,
            TaskApplication.id != application_id,
            TaskApplication.status == ApplicationStatus.PENDING,
        )
        .values(status=ApplicationStatus.NOT_SELECTED)
        .execution_options(synchronize_session=False)
    )

    # 4. Assign the task
    task.status = TaskStatus.ASSIGNED
    task.assigned_worker_id = app.worker_id
    task.assigned_at = _now()

    # 5. Commit — releases the lock
    approved_worker_id = app.worker_id
    await db.commit()

    # 6. Notify (after commit)
    sub = await db.get(Subcategory, task.subcategory_id)
    name = sub.name if sub else "Task"
    when = task.scheduled_at.astimezone(timezone.utc).strftime("%b %d")
    _push(
        background, [approved_worker_id],
        "🎉 You got the job!",
        f"{name} · {_money(app.proposed_budget or task.budget)} · {when}",
        f"/tasks/{task_id}",
    )
    _push(
        background, not_selected_ids,
        "Task assigned to another worker",
        f"The {name} task was assigned to another worker.",
        "/my-jobs",
    )

    task, lat, lng = await _load_task(db, task_id)
    return _task_out(task, lat, lng, **(await _owner_extras(db, task.id)))


async def reopen_and_notify(
    db: AsyncSession, redis: Redis, background: BackgroundTasks, user: User, task_id: uuid.UUID
) -> tuple[TaskOut, int]:
    """After a worker cancelled, the customer (optionally edits and) re-broadcasts the task.

    Deletes all NOT_SELECTED and CANCELLED applications so those workers start
    fresh and can apply again (the unique constraint would otherwise block them),
    then re-runs matching and notifies eligible workers + the previously
    not-selected workers.
    """
    await expire_stale_tasks(db)
    task = await _lock_task(db, task_id)
    _require_owner(task, user)

    if task.status != TaskStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only open tasks can be reopened.")

    stale = (
        await db.execute(
            select(TaskApplication.worker_id, TaskApplication.status).where(
                TaskApplication.task_id == task_id,
                TaskApplication.status.in_([ApplicationStatus.NOT_SELECTED, ApplicationStatus.CANCELLED]),
            )
        )
    ).all()
    if not any(s == ApplicationStatus.CANCELLED for _, s in stale):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This task has not been cancelled by a worker.",
        )

    not_selected = {w for w, s in stale if s == ApplicationStatus.NOT_SELECTED}
    cancelled_by = {w for w, s in stale if s == ApplicationStatus.CANCELLED}

    await db.execute(
        delete(TaskApplication)
        .where(
            TaskApplication.task_id == task_id,
            TaskApplication.status.in_([ApplicationStatus.NOT_SELECTED, ApplicationStatus.CANCELLED]),
        )
        .execution_options(synchronize_session=False)
    )
    await db.commit()

    # Workers with a live PENDING application already know about this task
    already_pending = set(
        (
            await db.execute(
                select(TaskApplication.worker_id).where(
                    TaskApplication.task_id == task_id,
                    TaskApplication.status == ApplicationStatus.PENDING,
                )
            )
        ).scalars().all()
    )

    notified = await _broadcast_task(
        db, redis, background, task,
        title="🔔 A task is available again",
        extra_worker_ids=not_selected,
        exclude_worker_ids=cancelled_by | already_pending,
    )

    task, lat, lng = await _load_task(db, task_id)
    return _task_out(task, lat, lng, **(await _owner_extras(db, task.id))), notified


# ── Worker: feed / apply / withdraw / cancel ──────────────────────────────


async def list_available_tasks(db: AsyncSession, redis: Redis, user: User) -> list[TaskOut]:
    """OPEN, future tasks within radius that match the worker's capabilities
    and that the worker hasn't already applied to."""
    await _require_worker(db, user, must_be_online=False)
    await expire_stale_tasks(db)

    point = await get_worker_point(db, redis, user.id)
    if not point:
        return []
    lat, lng, _ = point

    worker_geog = func.geography(make_point(lat, lng))
    task_geog = func.geography(Task.location)
    distance = func.ST_Distance(task_geog, worker_geog).label("distance_m")

    my_caps = select(WorkerCapability.subcategory_id).where(WorkerCapability.worker_id == user.id)
    applied = select(TaskApplication.task_id).where(
        TaskApplication.worker_id == user.id,
        TaskApplication.status != ApplicationStatus.WITHDRAWN,
    )

    rows = (
        await db.execute(
            _task_query()
            .add_columns(distance)
            .where(
                Task.status == TaskStatus.OPEN,
                Task.scheduled_at > func.now(),
                Task.customer_id != user.id,
                Task.subcategory_id.in_(my_caps),
                Task.id.not_in(applied),
                func.ST_DWithin(task_geog, worker_geog, search_radius_meters()),
            )
            .order_by(distance)
            .limit(100)
        )
    ).all()

    return [
        _task_out(task, t_lat, t_lng, distance_km=round(float(d) / 1000, 1))
        for task, t_lat, t_lng, d in rows
    ]


async def apply_to_task(
    db: AsyncSession,
    redis: Redis,
    background: BackgroundTasks,
    user: User,
    task_id: uuid.UUID,
    data: ApplyRequest,
) -> TaskOut:
    await _require_worker(db, user, must_be_online=True)
    await expire_stale_tasks(db)

    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    if task.customer_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't apply to your own task.")
    if task.status != TaskStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This task is no longer accepting applications.")

    has_cap = (
        await db.execute(
            select(WorkerCapability.id).where(
                WorkerCapability.worker_id == user.id,
                WorkerCapability.subcategory_id == task.subcategory_id,
            )
        )
    ).first()
    if not has_cap:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't offer this service.")

    # Distance check (same radius as matching)
    point = await get_worker_point(db, redis, user.id)
    if not point:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="We need your location to apply. Set a home base or allow location access.",
        )
    d = (
        await db.execute(
            select(
                func.ST_Distance(func.geography(Task.location), func.geography(make_point(point[0], point[1])))
            ).where(Task.id == task.id)
        )
    ).scalar()
    if d is None or d > search_radius_meters():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This task is outside your service radius.")
    distance_km = round(float(d) / 1000, 1)

    existing = (
        await db.execute(
            select(TaskApplication).where(
                TaskApplication.task_id == task_id, TaskApplication.worker_id == user.id
            )
        )
    ).scalars().first()

    if existing:
        if existing.status != ApplicationStatus.WITHDRAWN:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already applied to this task.")
        # Re-applying after a withdrawal reactivates the same row
        existing.status = ApplicationStatus.PENDING
        existing.message = data.message
        existing.proposed_budget = data.proposed_budget
        existing.distance_km = distance_km
    else:
        db.add(TaskApplication(
            task_id=task_id,
            worker_id=user.id,
            status=ApplicationStatus.PENDING,
            message=data.message,
            proposed_budget=data.proposed_budget,
            distance_km=distance_km,
        ))
    await db.commit()

    sub = await db.get(Subcategory, task.subcategory_id)
    _push(
        background, [task.customer_id],
        "📩 New application!",
        f"{user.user_name} applied to your {sub.name if sub else ''} task".replace("  ", " "),
        f"/tasks/{task_id}",
        tag=f"apps-{task_id}",
    )

    return await get_task_detail(db, redis, user, task_id)


async def withdraw_application(db: AsyncSession, redis: Redis, user: User, task_id: uuid.UUID) -> TaskOut:
    app = (
        await db.execute(
            select(TaskApplication).where(
                TaskApplication.task_id == task_id, TaskApplication.worker_id == user.id
            )
        )
    ).scalars().first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    if app.status != ApplicationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending applications can be withdrawn.",
        )
    app.status = ApplicationStatus.WITHDRAWN
    await db.commit()
    return await get_task_detail(db, redis, user, task_id)


async def worker_cancel_assignment(
    db: AsyncSession, redis: Redis, background: BackgroundTasks, user: User, task_id: uuid.UUID
) -> TaskOut:
    """Assigned worker backs out. Task goes back to OPEN; the customer is notified
    and can edit the task and re-notify workers (see reopen_and_notify)."""
    task = await _lock_task(db, task_id)
    if task.assigned_worker_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found or you are not the assigned worker.")
    if task.status != TaskStatus.ASSIGNED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task is not in an assigned state.")

    await db.execute(
        update(TaskApplication)
        .where(
            TaskApplication.task_id == task_id,
            TaskApplication.worker_id == user.id,
            TaskApplication.status == ApplicationStatus.APPROVED,
        )
        .values(status=ApplicationStatus.CANCELLED)
        .execution_options(synchronize_session=False)
    )

    task.status = TaskStatus.OPEN
    task.assigned_worker_id = None
    task.assigned_at = None
    customer_id = task.customer_id
    await db.commit()

    _push(
        background, [customer_id],
        "⚠️ Worker cancelled",
        "The assigned worker cancelled. You can edit and reopen your task.",
        f"/tasks/{task_id}",
    )

    return await get_task_detail(db, redis, user, task_id)


async def list_my_applications(db: AsyncSession, user: User) -> list[MyApplicationOut]:
    await expire_stale_tasks(db)
    apps = (
        await db.execute(
            select(TaskApplication)
            .where(TaskApplication.worker_id == user.id)
            .order_by(TaskApplication.updated_at.desc())
        )
    ).scalars().all()
    if not apps:
        return []

    task_rows = (await db.execute(_task_query().where(Task.id.in_([a.task_id for a in apps])))).all()
    tasks = {t.id: (t, lat, lng) for t, lat, lng in task_rows}

    out = []
    for app in apps:
        if app.task_id not in tasks:
            continue
        t, lat, lng = tasks[app.task_id]
        out.append(MyApplicationOut(
            id=app.id,
            status=app.status,
            message=app.message,
            proposed_budget=app.proposed_budget,
            distance_km=float(app.distance_km) if app.distance_km is not None else None,
            created_at=app.created_at,
            task=_task_out(t, lat, lng),
        ))
    return out
