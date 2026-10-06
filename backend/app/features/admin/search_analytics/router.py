from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_admin
from app.features.admin.search_analytics import service
from app.features.admin.search_analytics.schemas import (
    SearchLogOut,
    AggregatedSearchOut,
    LocationCellOut,
)

router = APIRouter(prefix="/analytics/searches", tags=["Admin - Analytics"])


@router.get("/feed", response_model=list[SearchLogOut])
async def get_feed(
    cell_lat: float | None = Query(None, ge=-90, le=90),
    cell_lng: float | None = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_async_db),
    _admin=Depends(get_current_admin),
):
    """Recent searches (optionally within one ~1 km cell)."""
    return await service.get_search_feed(db, cell_lat=cell_lat, cell_lng=cell_lng)


@router.get("/aggregated", response_model=list[AggregatedSearchOut])
async def get_aggregated(
    cell_lat: float | None = Query(None, ge=-90, le=90),
    cell_lng: float | None = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_async_db),
    _admin=Depends(get_current_admin),
):
    """Query leaderboard (optionally within one ~1 km cell)."""
    return await service.get_aggregated_searches(db, cell_lat=cell_lat, cell_lng=cell_lng)


@router.get("/locations", response_model=list[LocationCellOut])
async def get_locations(
    db: AsyncSession = Depends(get_async_db),
    _admin=Depends(get_current_admin),
):
    """Demand hotspots grouped into ~1 km grid cells."""
    return await service.get_location_cells(db)
