import uuid
from datetime import datetime
from pydantic import BaseModel

from app.features.workers.enums import VerificationStatus, DocumentType, ProofType


class PendingWorkerRow(BaseModel):
    """One row in the admin approval queue table."""
    user_id: uuid.UUID
    user_name: str
    email: str
    phone: str | None
    avatar_url: str
    verification_status: VerificationStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: uuid.UUID
    document_type: DocumentType
    document_url: str            # raw r2:// or public URL
    document_number: str | None
    preview_url: str | None      # presigned GET URL (resolved by the service)

    model_config = {"from_attributes": True}


class ProofOut(BaseModel):
    id: uuid.UUID
    proof_type: ProofType
    url: str
    preview_url: str | None      # presigned GET URL for private files
    title: str | None
    description: str | None

    model_config = {"from_attributes": True}


class CapabilityDetailOut(BaseModel):
    id: uuid.UUID
    subcategory_id: uuid.UUID
    subcategory_name: str | None
    proofs: list[ProofOut]

    model_config = {"from_attributes": True}


class WorkerFullDetail(BaseModel):
    """Everything the admin needs to see about a worker."""
    user_id: uuid.UUID
    user_name: str
    email: str
    phone: str | None
    avatar_url: str
    verification_status: VerificationStatus
    verified_by: uuid.UUID | None
    is_available: bool
    created_at: datetime
    verification_documents: list[DocumentOut]
    capabilities: list[CapabilityDetailOut]

    model_config = {"from_attributes": True}


class ApprovalAction(BaseModel):
    """Request body for approve / reject."""
    reason: str | None = None   # optional rejection reason


class ApprovalResult(BaseModel):
    user_id: uuid.UUID
    verification_status: VerificationStatus
    message: str
