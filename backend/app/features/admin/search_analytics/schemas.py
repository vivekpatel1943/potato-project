import uuid
from datetime import datetime
from pydantic import BaseModel


class SearchLogOut(BaseModel):
    id: uuid.UUID
    query: str
    results_count: int
    selected_subcategory_id: uuid.UUID | None
    selected_service: str | None   # name of the subcategory picked (None => abandoned)
    user_name: str | None          # None => Guest
    latitude: float | None
    longitude: float | None
    created_at: datetime


class AggregatedSearchOut(BaseModel):
    query: str
    total_searches: int
    zero_result_searches: int
    conversions: int               # searches where the user picked a result
    last_searched_at: datetime


class LocationCellOut(BaseModel):
    """A ~1.1 km grid cell (coordinates rounded to 2 decimals)."""
    cell_lat: float
    cell_lng: float
    total_searches: int
    zero_result_searches: int
    top_query: str | None
