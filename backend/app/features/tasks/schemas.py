import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import AwareDatetime, BaseModel, Field

from app.features.tasks.enums import TaskStatus, ApplicationStatus


# ── Requests ───────────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    subcategory_id: uuid.UUID
    description: str = Field(..., min_length=5, max_length=2000)
    scheduled_at: AwareDatetime
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: str | None = Field(None, max_length=500)
    budget: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    specific_requirements: str | None = Field(None, max_length=2000)


class TaskUpdate(BaseModel):
    """All fields optional — only provided fields are changed."""
    description: str | None = Field(None, min_length=5, max_length=2000)
    scheduled_at: AwareDatetime | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    address: str | None = Field(None, max_length=500)
    budget: Decimal | None = Field(None, gt=0, max_digits=10, decimal_places=2)
    specific_requirements: str | None = Field(None, max_length=2000)


class ApplyRequest(BaseModel):
    message: str | None = Field(None, max_length=1000)
    proposed_budget: Decimal | None = Field(None, gt=0, max_digits=10, decimal_places=2)


# ── Responses ──────────────────────────────────────────────────────────────


class MyApplicationSummary(BaseModel):
    id: uuid.UUID
    status: ApplicationStatus
    message: str | None = None
    proposed_budget: Decimal | None = None
    created_at: datetime


class TaskOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str | None = None
    subcategory_id: uuid.UUID
    subcategory_name: str | None = None
    category_name: str | None = None

    description: str
    scheduled_at: datetime
    latitude: float
    longitude: float
    address: str | None = None
    budget: Decimal
    specific_requirements: str | None = None

    status: TaskStatus
    assigned_worker_id: uuid.UUID | None = None
    assigned_worker_name: str | None = None
    assigned_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Context-dependent extras
    is_owner: bool = False
    pending_applications: int | None = None      # owner only
    worker_cancelled: bool = False               # owner only: an assigned worker backed out
    distance_km: float | None = None             # worker views
    my_application: MyApplicationSummary | None = None  # worker views


class ApplicationOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: str | None = None
    worker_avatar_url: str | None = None
    status: ApplicationStatus
    message: str | None = None
    proposed_budget: Decimal | None = None
    distance_km: float | None = None
    created_at: datetime


class MyApplicationOut(BaseModel):
    """A worker's own application with a compact task summary."""
    id: uuid.UUID
    status: ApplicationStatus
    message: str | None = None
    proposed_budget: Decimal | None = None
    distance_km: float | None = None
    created_at: datetime
    task: TaskOut


class ReopenResult(BaseModel):
    task: TaskOut
    notified_workers: int
