from pydantic import BaseModel, EmailStr


class OTPRequest(BaseModel):
    """User submits their email to receive an OTP."""
    email: EmailStr


class OTPVerify(BaseModel):
    """User submits their email + the OTP they received."""
    email: EmailStr
    otp_code: str


class TokenResponse(BaseModel):
    """Returned after successful OTP verification."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool  # So the frontend knows whether to show onboarding
