import uuid
from pydantic import BaseModel, Field


class SearchLogCreate(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    results_count: int = Field(..., ge=0, le=1000)
    selected_subcategory_id: uuid.UUID | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
