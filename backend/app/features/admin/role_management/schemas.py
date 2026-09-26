from pydantic import BaseModel, EmailStr


class AssignAdminRequest(BaseModel):
    """Payload to promote or demote a user by email."""
    email: EmailStr


class AdminUserOut(BaseModel):
    """Minimal user info returned after an admin operation."""
    id: str          # UUID as string
    email: str
    user_name: str
    role: str

    model_config = {"from_attributes": True}
