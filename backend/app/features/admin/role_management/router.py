from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db
from app.features.auth.dependencies import get_current_admin
from app.features.admin.role_management import service
from app.features.admin.role_management.schemas import AssignAdminRequest, AdminUserOut

router = APIRouter(tags=["Admin - Role Management"])


@router.post("/assign-admin", response_model=AdminUserOut)
async def assign_admin(
    body: AssignAdminRequest,
    db: AsyncSession = Depends(get_async_db),
    _admin=Depends(get_current_admin),        # 🔒 guard
):
    """Promote a user to admin by email. Only callable by existing admins."""
    user = await service.assign_admin_role(db, body.email)
    return AdminUserOut(
        id=str(user.id),
        email=user.email,
        user_name=user.user_name,
        role=user.role.value,
    )


@router.post("/revoke-admin", response_model=AdminUserOut)
async def revoke_admin(
    body: AssignAdminRequest,
    db: AsyncSession = Depends(get_async_db),
    _admin=Depends(get_current_admin),        # 🔒 guard
):
    """Demote an admin back to a regular user. Only callable by existing admins."""
    user = await service.revoke_admin_role(db, body.email)
    return AdminUserOut(
        id=str(user.id),
        email=user.email,
        user_name=user.user_name,
        role=user.role.value,
    )
