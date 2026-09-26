from redis.asyncio import Redis
from app.shared.cache import list_cache_keys, delete_cached, flush_all_caches


async def list_all_caches(redis: Redis) -> list[dict]:
    """List all application cache keys with TTLs."""
    return await list_cache_keys(redis)


async def flush_single_cache(redis: Redis, key: str) -> bool:
    """Flush a specific cache by key (prepends cache: prefix)."""
    return await delete_cached(redis, f"cache:{key}")


async def flush_all(redis: Redis) -> int:
    """Flush ALL application caches. Returns count deleted."""
    return await flush_all_caches(redis)
