import uuid
from pydantic import BaseModel, Field

from app.features.workers.enums import VerificationStatus, ProofType, DocumentType


# ── Request Schemas ────────────────────────────────────────────────────────


class VerificationDocumentCreate(BaseModel):
    document_type: DocumentType
    document_url: str
    document_number: str | None = None


class CapabilityProofCreate(BaseModel):
    proof_type: ProofType
    url: str
    title: str | None = None
    description: str | None = None


class CapabilityCreate(BaseModel):
    subcategory_id: uuid.UUID
    proofs: list[CapabilityProofCreate] = []


class WorkerProfileCreate(BaseModel):
    avatar_url: str
    home_base_lat: float | None = None
    home_base_lng: float | None = None
    verification_documents: list[VerificationDocumentCreate] = Field(..., min_length=1)
    capabilities: list[CapabilityCreate] = Field(..., min_length=1)


class WorkerProfileUpdate(BaseModel):
    avatar_url: str
    home_base_lat: float | None = None
    home_base_lng: float | None = None
    verification_documents: list[VerificationDocumentCreate] = Field(..., min_length=1)
    capabilities: list[CapabilityCreate] = Field(..., min_length=1)


class AvailabilityUpdate(BaseModel):
    is_available: bool


class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


# ── Presigned URL Schemas ──────────────────────────────────────────────────


class PresignedUrlRequest(BaseModel):
    file_name: str
    content_type: str
    bucket_type: str = "public"  # "public" or "private"


class PresignedUrlResponse(BaseModel):
    upload_url: str
    file_url: str


class PresignedGetRequest(BaseModel):
    file_url: str


class PresignedGetResponse(BaseModel):
    download_url: str

# onboarding_draft 
class DraftSaveRequest(BaseModel):
    current_step: int
    draft_data: dict  # { avatar_url?, documents?, subcategory_ids?, proofs? }


class DraftResponse(BaseModel):
    current_step: int
    draft_data: dict

    model_config = {"from_attributes": True}


class DeleteUploadRequest(BaseModel):
    file_url: str
    bucket_type: str = "public"


# ── Response Schemas ───────────────────────────────────────────────────────


class VerificationDocumentOut(BaseModel):
    id: uuid.UUID
    document_type: DocumentType
    document_url: str
    document_number: str | None = None

    model_config = {"from_attributes": True}


class CapabilityProofOut(BaseModel):
    id: uuid.UUID
    proof_type: ProofType
    url: str
    title: str | None = None
    description: str | None = None

    model_config = {"from_attributes": True}


class CapabilityOut(BaseModel):
    id: uuid.UUID
    subcategory_id: uuid.UUID
    subcategory_name: str | None = None
    proofs: list[CapabilityProofOut] = []

    model_config = {"from_attributes": True}


class WorkerProfileOut(BaseModel):
    user_id: uuid.UUID
    avatar_url: str
    is_available: bool
    verification_status: VerificationStatus
    capabilities: list[CapabilityOut] = []
    verification_documents: list[VerificationDocumentOut] = []

    model_config = {"from_attributes": True}

class WorkerPublicCardOut(BaseModel):
    user_id: uuid.UUID
    user_name: str
    avatar_url: str
    rating: float = 4.8
    tasks_delivered: int = 24
    capabilities: list[str]

    model_config = {"from_attributes": True}
