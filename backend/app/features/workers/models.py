import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, ForeignKey, func , Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.features.workers.enums import VerificationStatus


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    # user_id is BOTH the Primary Key and a Foreign Key → enforces 1:1 with users
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Verification status — "pending", "under_review", "verified", "rejected"
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False
    )

    # Which admin verified this worker (nullable until verified)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Worker images — stored as an array of Cloudflare R2 URLs
    images: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
