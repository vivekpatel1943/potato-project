import uuid
from pydantic import BaseModel


class UserMeOut(BaseModel):
    """The authenticated user's own profile data."""
    id: uuid.UUID
    email: str
    user_name: str
    phone: str | None
    role: str
    is_active: bool
    is_email_verified: bool
    is_phone_verified: bool

    model_config = {"from_attributes": True}
