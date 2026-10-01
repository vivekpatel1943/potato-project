from pydantic import BaseModel
import uuid


class SubcategoryAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    keywords: list[str] = []

    model_config = {"from_attributes": True}


class CategoryAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    subcategories: list[SubcategoryAdminOut]

    model_config = {"from_attributes": True}


class UpdateEntityRequest(BaseModel):
    is_active: bool | None = None
    name: str | None = None
    description: str | None = None
    keywords: list[str] | None = None


class CreateCategoryRequest(BaseModel):
    name: str
    description: str | None = None


class CreateSubcategoryRequest(BaseModel):
    category_id: str
    name: str
    description: str | None = None
    keywords: list[str] = []
