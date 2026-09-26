"""
Shared cache utilities.

All application cache keys are namespaced with "cache:" to avoid
collisions with OTP keys, rate-limit keys, etc.
"""
import json
from redis.asyncio import Redis

CACHE_PREFIX = "cache"


def cache_key(*parts: str) -> str:
    """Build a namespaced cache key. e.g. cache_key("categories", "all") → "cache:categories:all" """
    return f"{CACHE_PREFIX}:{':'.join(parts)}"


async def get_cached(redis: Redis, key: str) -> dict | list | None:
    """Retrieve and deserialize a cached value."""
    raw = await redis.get(key)
    if raw:
        return json.loads(raw)
    return None


async def set_cached(redis: Redis, key: str, data, ttl_seconds: int) -> None:
    """Serialize and store a value with TTL."""
    await redis.setex(key, ttl_seconds, json.dumps(data))


async def delete_cached(redis: Redis, key: str) -> bool:
    """Delete a specific cache key. Returns True if it existed."""
    return (await redis.delete(key)) > 0


async def list_cache_keys(redis: Redis) -> list[dict]:
    """List all application cache keys with their TTLs."""
    keys = []
    async for key in redis.scan_iter(f"{CACHE_PREFIX}:*"):
        # key comes back as bytes or str depending on redis config
        key_str = key if isinstance(key, str) else key.decode()
        ttl = await redis.ttl(key_str)
        keys.append({"key": key_str, "ttl_seconds": ttl})
    return keys


async def flush_all_caches(redis: Redis) -> int:
    """Delete all application cache keys. Returns count deleted."""
    keys = [key async for key in redis.scan_iter(f"{CACHE_PREFIX}:*")]
    if keys:
        await redis.delete(*keys)
    return len(keys)
