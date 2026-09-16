from fastapi import Request, HTTPException
from redis.asyncio import Redis


async def check_rate_limit(
    redis: Redis,
    request: Request,
    prefix: str,
    cooldown_seconds: int,
) -> None:
    """
    Rate-limit by client IP. Raises 429 with Retry-After header
    if the caller is within the cooldown window.

    Uses X-Forwarded-For when behind a reverse proxy (Traefik/Caddy),
    falls back to request.client.host for local dev.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host

    rate_key = f"rate:{prefix}:{client_ip}"

    if await redis.exists(rate_key):
        ttl = await redis.ttl(rate_key)
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {ttl} seconds.",
            headers={"Retry-After": str(ttl)},
        )

    await redis.setex(rate_key, cooldown_seconds, "1")
