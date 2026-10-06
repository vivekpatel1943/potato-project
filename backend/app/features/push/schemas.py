from pydantic import BaseModel, Field


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=1)
    p256dh_key: str = Field(..., min_length=1)
    auth_key: str = Field(..., min_length=1)


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class VapidPublicKeyOut(BaseModel):
    public_key: str
