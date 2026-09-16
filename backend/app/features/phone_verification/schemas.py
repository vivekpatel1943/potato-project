from pydantic import BaseModel, Field


class PhoneVerifyRequest(BaseModel):
    """User submits their phone number to start verification."""
    phone: str = Field(
        ...,
        pattern=r"^\+\d{10,15}$",
        description="Phone number in E.164 format, e.g. +918103614609",
    )


class PhoneVerifyResponse(BaseModel):
    """Returned after requesting phone verification."""
    whatsapp_link: str  # wa.me deep link with pre-filled message
    message: str = "Click the link to verify via WhatsApp, or enter the code manually."


class PhoneConfirmRequest(BaseModel):
    """User (or WhatsApp bot) submits phone + verification code."""
    phone: str = Field(
        ...,
        pattern=r"^\+\d{10,15}$",
        description="Phone number in E.164 format",
    )
    code: str = Field(..., min_length=6, max_length=6)


class PhoneConfirmResponse(BaseModel):
    """Returned after successful phone verification."""
    verified: bool
    phone: str
