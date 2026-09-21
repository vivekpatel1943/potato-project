from enum import Enum 

class VerificationStatus(str,Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"

class ProofType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    DOC = "doc"

class DocumentType(str, Enum):
    AADHAAR = "aadhaar"
    DRIVING_LICENSE = "driving_license"
    PASSPORT = "passport"
    PAN = "pan"
    OTHER = "other"
