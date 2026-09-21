import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, ForeignKey, func , Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.features.workers.enums import VerificationStatus, ProofType, DocumentType

if TYPE_CHECKING:
    from app.features.categories.models import Subcategory

class WorkerVerificationDocument(Base):
    __tablename__ = "worker_verification_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worker_profiles.user_id", ondelete="CASCADE"), nullable=False
    )
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False)
    document_url: Mapped[str] = mapped_column(String, nullable=False)
    
    # Optional metadata
    document_number: Mapped[str | None] = mapped_column(String(100), nullable=True) 
    
    worker: Mapped["WorkerProfile"] = relationship("WorkerProfile", back_populates="verification_documents")

class WorkerCapabilityProof(Base):
    __tablename__ = "worker_capability_proofs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_capability_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worker_capabilities.id", ondelete="CASCADE"), nullable=False
    )
    proof_type: Mapped[ProofType] = mapped_column(Enum(ProofType), nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    capability: Mapped["WorkerCapability"] = relationship("WorkerCapability", back_populates="proofs")


class WorkerCapability(Base):
    __tablename__ = "worker_capabilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worker_profiles.user_id", ondelete="CASCADE"), nullable=False
    )
    subcategory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subcategories.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    worker: Mapped["WorkerProfile"] = relationship("WorkerProfile", back_populates="capabilities")
    subcategory: Mapped["Subcategory"] = relationship("Subcategory", back_populates="worker_capabilities")
    proofs: Mapped[list["WorkerCapabilityProof"]] = relationship(
        "WorkerCapabilityProof", back_populates="capability", cascade="all, delete-orphan"
    )



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

    # Worker's profile picture
    avatar_url: Mapped[str] = mapped_column(String, nullable=False)

    # The capabilities/services this worker offers
    capabilities: Mapped[list["WorkerCapability"]] = relationship(
        "WorkerCapability", back_populates="worker", cascade="all, delete-orphan"
    )

    # The identity verification documents for this worker
    verification_documents: Mapped[list["WorkerVerificationDocument"]] = relationship(
        "WorkerVerificationDocument", back_populates="worker", cascade="all, delete-orphan"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
