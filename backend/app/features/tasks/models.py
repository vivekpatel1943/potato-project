import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.features.tasks.enums import TaskStatus, ApplicationStatus

if TYPE_CHECKING:
    from app.features.users.models import User
    from app.features.categories.models import Subcategory


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subcategory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subcategories.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    description: Mapped[str] = mapped_column(Text, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # PostGIS POINT (lng lat) — SRID 4326 for ST_DWithin spatial queries.
    # geoalchemy2 creates a GiST spatial index automatically.
    location: Mapped[str] = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)  # display only

    budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    specific_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.OPEN, nullable=False, index=True
    )

    # Set when the customer approves a worker
    assigned_worker_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    customer: Mapped["User"] = relationship("User", foreign_keys=[customer_id])
    assigned_worker: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_worker_id])
    subcategory: Mapped["Subcategory"] = relationship("Subcategory")
    applications: Mapped[list["TaskApplication"]] = relationship(
        "TaskApplication", back_populates="task", cascade="all, delete-orphan"
    )


class TaskApplication(Base):
    __tablename__ = "task_applications"
    # One application row per worker per task
    __table_args__ = (UniqueConstraint("task_id", "worker_id", name="uq_task_applications_task_id_worker_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.PENDING, nullable=False
    )

    # Worker's pitch and optional counter-offer
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_budget: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Snapshot of the worker's distance to the task when they applied (km)
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(6, 1), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="applications")
    worker: Mapped["User"] = relationship("User")
