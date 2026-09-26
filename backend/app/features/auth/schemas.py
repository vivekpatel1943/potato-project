from pydantic import BaseModel, EmailStr


class OTPRequest(BaseModel):
    """User submits their email to receive an OTP."""
    email: EmailStr


class OTPVerify(BaseModel):
    """User submits their email + the OTP they received."""
    email: EmailStr
    otp_code: str


class RefreshRequest(BaseModel):
    """User submits a refresh token to get new tokens."""
    refresh_token: str


class TokenResponse(BaseModel):
    """Returned after successful OTP verification."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool  # So the frontend knows whether to show onboarding
    user_name: str  # Auto-generated from email
    role: str  # "user" | "admin"
    is_phone_verified: bool
