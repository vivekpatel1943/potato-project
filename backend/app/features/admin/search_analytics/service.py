from decimal import Decimal

from sqlalchemy import select, func, desc, case, cast, Numeric, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.categories.models import Subcategory
from app.features.search_logs.models import SearchLog
from app.features.users.models import User

# ~1.1 km grid cells. Postgres ROUND(x, n) needs NUMERIC.
_LAT_CELL = func.round(cast(SearchLog.latitude, Numeric), 2)
_LNG_CELL = func.round(cast(SearchLog.longitude, Numeric), 2)
# Cast back to float for JSON output
CELL_LAT = cast(_LAT_CELL, Float)
CELL_LNG = cast(_LNG_CELL, Float)

_ZERO_RESULTS = func.sum(case((SearchLog.results_count == 0, 1), else_=0))


def _cell_filter(stmt, cell_lat: float | None, cell_lng: float | None):
    """Optionally restrict a query to one ~1 km grid cell (compared as NUMERIC, no float drift)."""
    if cell_lat is not None and cell_lng is not None:
        stmt = stmt.where(
            _LAT_CELL == Decimal(f"{cell_lat:.2f}"),
            _LNG_CELL == Decimal(f"{cell_lng:.2f}"),
        )
    return stmt


async def get_search_feed(
    db: AsyncSession, limit: int = 50, cell_lat: float | None = None, cell_lng: float | None = None
) -> list[dict]:
    """Most recent searches with the searcher's name (guests => None) and the service they picked."""
    stmt = (
        select(SearchLog, User.user_name, Subcategory.name)
        .outerjoin(User, User.id == SearchLog.user_id)
        .outerjoin(Subcategory, Subcategory.id == SearchLog.selected_subcategory_id)
        .order_by(SearchLog.created_at.desc())
        .limit(limit)
    )
    stmt = _cell_filter(stmt, cell_lat, cell_lng)
    rows = (await db.execute(stmt)).all()
    return [
        {
            **{c.name: getattr(log, c.name) for c in SearchLog.__table__.columns},
            "user_name": user_name,
            "selected_service": service_name,
        }
        for log, user_name, service_name in rows
    ]


async def get_aggregated_searches(
    db: AsyncSession, limit: int = 50, cell_lat: float | None = None, cell_lng: float | None = None
) -> list[dict]:
    """Query leaderboard: volume, zero-result count, conversions."""
    stmt = (
        select(
            SearchLog.query,
            func.count(SearchLog.id).label("total_searches"),
            _ZERO_RESULTS.label("zero_result_searches"),
            func.count(SearchLog.selected_subcategory_id).label("conversions"),
            func.max(SearchLog.created_at).label("last_searched_at"),
        )
        .group_by(SearchLog.query)
        .order_by(desc("total_searches"))
        .limit(limit)
    )
    stmt = _cell_filter(stmt, cell_lat, cell_lng)
    return [dict(r._mapping) for r in (await db.execute(stmt)).all()]


async def get_location_cells(db: AsyncSession, limit: int = 50) -> list[dict]:
    """Searches grouped into ~1 km cells, with the most-searched query per cell."""
    has_loc = SearchLog.latitude.is_not(None) & SearchLog.longitude.is_not(None)

    cells_stmt = (
        select(
            CELL_LAT.label("cell_lat"),
            CELL_LNG.label("cell_lng"),
            func.count(SearchLog.id).label("total_searches"),
            _ZERO_RESULTS.label("zero_result_searches"),
        )
        .where(has_loc)
        .group_by(CELL_LAT, CELL_LNG)
        .order_by(desc("total_searches"))
        .limit(limit)
    )
    rows = [dict(r._mapping) for r in (await db.execute(cells_stmt)).all()]
    if not rows:
        return []

    # Top query per cell in ONE extra query using DISTINCT ON (Postgres)
    counts = (
        select(
            CELL_LAT.label("cell_lat"),
            CELL_LNG.label("cell_lng"),
            SearchLog.query.label("query"),
            func.count().label("n"),
        )
        .where(has_loc)
        .group_by(CELL_LAT, CELL_LNG, SearchLog.query)
        .subquery()
    )
    top_stmt = (
        select(counts.c.cell_lat, counts.c.cell_lng, counts.c.query)
        .distinct(counts.c.cell_lat, counts.c.cell_lng)
        .order_by(counts.c.cell_lat, counts.c.cell_lng, counts.c.n.desc())
    )
    top = {(r.cell_lat, r.cell_lng): r.query for r in (await db.execute(top_stmt)).all()}
    for r in rows:
        r["top_query"] = top.get((r["cell_lat"], r["cell_lng"]))
    return rows
