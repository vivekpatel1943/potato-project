"""Matching engine — finds which workers qualify for a task.

Filter pipeline (subscription check skipped for MVP):
    1. Capability — worker offers task.subcategory_id
    2. Verified   — verification_status = VERIFIED
    3. Available  — is_available = True (worker is online)
    4. Proximity  — within SEARCH_RADIUS of the task (PostGIS ST_DWithin on geography)

Location source per worker:
    - Live GPS from Redis if present (< 2h old), else
    - home_base from PostgreSQL, else
    - not matchable.

Both proximity checks run inside PostgreSQL with ST_DWithin — one query for
live-located workers (via unnest of arrays) and one for home_base workers.
"""
import uuid

from redis.asyncio import Redis
from sqlalchemy import select, func, text, bindparam
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID, DOUBLE_PRECISION
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.features.tasks.models import Task
from app.features.workers.enums import VerificationStatus
from app.features.workers.location import get_live_locations, get_live_location
from app.features.workers.models import WorkerProfile, WorkerCapability

settings = Settings()


def search_radius_meters() -> float:
    return settings.search_radius_km * 1000


def make_point(lat: float, lng: float):
    """SQL expression for a WGS84 POINT. Note PostGIS order is (lng, lat)."""
    return func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)


async def get_worker_point(
    db: AsyncSession, redis: Redis, worker_id: uuid.UUID
) -> tuple[float, float, str] | None:
    """Return (lat, lng, source) for a worker: live GPS → home_base → None."""
    live = await get_live_location(redis, worker_id)
    if live:
        return (live[0], live[1], "live")

    row = (
        await db.execute(
            select(
                func.ST_Y(WorkerProfile.home_base).label("lat"),
                func.ST_X(WorkerProfile.home_base).label("lng"),
            ).where(WorkerProfile.user_id == worker_id, WorkerProfile.home_base.isnot(None))
        )
    ).first()
    if row and row.lat is not None:
        return (float(row.lat), float(row.lng), "home_base")
    return None


async def find_eligible_workers(db: AsyncSession, redis: Redis, task: Task) -> list[dict]:
    """Return [{worker_id, distance_km, location_source}] for every worker who
    qualifies for `task`, nearest first. The task's own customer is excluded."""

    # ── Filters 1–3: capability + verified + available ──
    result = await db.execute(
        select(WorkerProfile.user_id)
        .join(WorkerCapability, WorkerProfile.user_id == WorkerCapability.worker_id)
        .where(
            WorkerCapability.subcategory_id == task.subcategory_id,
            WorkerProfile.verification_status == VerificationStatus.VERIFIED,
            WorkerProfile.is_available == True,
            WorkerProfile.user_id != task.customer_id,
        )
        .distinct()
    )
    candidate_ids: list[uuid.UUID] = [row[0] for row in result.all()]
    if not candidate_ids:
        return []

    radius = search_radius_meters()
    task_geog = (
        select(func.geography(Task.location)).where(Task.id == task.id).scalar_subquery()
    )
    eligible: list[dict] = []

    # ── Filter 4a: workers with live GPS in Redis ──
    live = await get_live_locations(redis, candidate_ids)
    if live:
        ids = list(live.keys())
        stmt = text(
            """
            SELECT w.id AS worker_id,
                   ST_Distance(geography(t.location),
                               geography(ST_SetSRID(ST_MakePoint(w.lng, w.lat), 4326))) AS distance_m
            FROM unnest(:ids, :lats, :lngs) AS w(id, lat, lng)
            CROSS JOIN tasks t
            WHERE t.id = :task_id
              AND ST_DWithin(geography(t.location),
                             geography(ST_SetSRID(ST_MakePoint(w.lng, w.lat), 4326)),
                             :radius)
            """
        ).bindparams(
            bindparam("ids", type_=ARRAY(PG_UUID(as_uuid=True))),
            bindparam("lats", type_=ARRAY(DOUBLE_PRECISION)),
            bindparam("lngs", type_=ARRAY(DOUBLE_PRECISION)),
        )
        rows = await db.execute(
            stmt,
            {
                "ids": ids,
                "lats": [live[i][0] for i in ids],
                "lngs": [live[i][1] for i in ids],
                "task_id": task.id,
                "radius": radius,
            },
        )
        for r in rows.all():
            eligible.append({
                "worker_id": r.worker_id,
                "distance_km": round(float(r.distance_m) / 1000, 1),
                "location_source": "live",
            })

    # ── Filter 4b: everyone else → fall back to home_base ──
    home_ids = [wid for wid in candidate_ids if wid not in live]
    if home_ids:
        home_geog = func.geography(WorkerProfile.home_base)
        rows = await db.execute(
            select(
                WorkerProfile.user_id,
                func.ST_Distance(task_geog, home_geog).label("distance_m"),
            ).where(
                WorkerProfile.user_id.in_(home_ids),
                WorkerProfile.home_base.isnot(None),
                func.ST_DWithin(task_geog, home_geog, radius),
            )
        )
        for r in rows.all():
            eligible.append({
                "worker_id": r.user_id,
                "distance_km": round(float(r.distance_m) / 1000, 1),
                "location_source": "home_base",
            })

    eligible.sort(key=lambda e: e["distance_km"])
    return eligible
