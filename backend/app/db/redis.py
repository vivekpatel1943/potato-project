from redis.asyncio import Redis
from typing import AsyncGenerator
from app.core.config import Settings

settings = Settings()

async def get_redis() -> AsyncGenerator[Redis, None]:
    """Yields an async Redis client. Used as a FastAPI dependency."""
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        yield redis
    finally:
        await redis.aclose()
