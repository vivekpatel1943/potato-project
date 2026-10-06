"""Ephemeral worker live-location storage (Redis).

Key:   worker:location:{worker_id}
Value: {"lat": 19.076, "lng": 72.877, "ts": 1696200000}
TTL:   settings.worker_location_ttl_seconds (default 2h)

After the TTL expires, matching falls back to the worker's `home_base`.
"""
import json
import time
import uuid

from redis.asyncio import Redis

from app.core.config import Settings

settings = Settings()


def _key(worker_id: uuid.UUID | str) -> str:
    return f"worker:location:{worker_id}"


async def set_worker_location(redis: Redis, worker_id: uuid.UUID, lat: float, lng: float) -> None:
    payload = json.dumps({"lat": lat, "lng": lng, "ts": int(time.time())})
    await redis.set(_key(worker_id), payload, ex=settings.worker_location_ttl_seconds)


async def get_live_locations(
    redis: Redis, worker_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[float, float]]:
    """Batch-fetch live locations. Returns {worker_id: (lat, lng)} for workers that have one."""
    if not worker_ids:
        return {}
    raw = await redis.mget([_key(w) for w in worker_ids])
    out: dict[uuid.UUID, tuple[float, float]] = {}
    for wid, value in zip(worker_ids, raw):
        if not value:
            continue
        try:
            loc = json.loads(value)
            out[wid] = (float(loc["lat"]), float(loc["lng"]))
        except (ValueError, KeyError, TypeError):
            continue
    return out


async def get_live_location(redis: Redis, worker_id: uuid.UUID) -> tuple[float, float] | None:
    return (await get_live_locations(redis, [worker_id])).get(worker_id)
