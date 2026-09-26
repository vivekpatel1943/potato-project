import uuid
from pydantic import BaseModel


class SubcategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    subcategories: list[SubcategoryOut] = []

    model_config = {"from_attributes": True}
