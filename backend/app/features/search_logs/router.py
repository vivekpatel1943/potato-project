import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.features.auth.dependencies import get_optional_user_id
from app.features.search_logs.schemas import SearchLogCreate
from app.features.search_logs.service import log_search_background

router = APIRouter(prefix="/search-logs", tags=["Search Logs"])


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_search_log(
    payload: SearchLogCreate,
    background: BackgroundTasks,
    user_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    """Public, fire-and-forget. Responds instantly; the insert happens in the background."""
    background.add_task(log_search_background, payload, user_id)
    return None
