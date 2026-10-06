import logging
import uuid

from app.db.session import AsyncSessionLocal
from app.features.search_logs.models import SearchLog
from app.features.search_logs.schemas import SearchLogCreate

logger = logging.getLogger(__name__)


async def log_search_background(data: SearchLogCreate, user_id: uuid.UUID | None) -> None:
    """
    Runs as a BackgroundTask AFTER the 202 response has been sent.
    Opens its own DB session (the request-scoped one is already closed).
    Must never raise: analytics failures must stay invisible to users.
    """
    try:
        # lower() + split()/join() also collapses repeated INNER spaces
        # ("ac   repair" -> "ac repair"). strip() only trims the ends.
        query = " ".join(data.query.lower().split())
        if not query:
            return

        has_loc = data.latitude is not None and data.longitude is not None

        async with AsyncSessionLocal() as db:
            db.add(SearchLog(
                query=query,
                results_count=data.results_count,
                selected_subcategory_id=data.selected_subcategory_id,
                user_id=user_id,
                latitude=round(data.latitude, 3) if has_loc else None,
                longitude=round(data.longitude, 3) if has_loc else None,
            ))
            await db.commit()
    except Exception:
        logger.exception("Failed to write search log")
