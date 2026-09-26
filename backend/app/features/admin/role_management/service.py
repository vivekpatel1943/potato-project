from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.features.users.models import User
from app.features.users.enums import Role


async def assign_admin_role(db: AsyncSession, email: str) -> User:
    """Look up a user by email and set their role to ADMIN."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with email: {email}",
        )

    if user.role == Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{email} is already an admin.",
        )

    user.role = Role.ADMIN
    await db.commit()
    await db.refresh(user)
    return user


async def revoke_admin_role(db: AsyncSession, email: str) -> User:
    """Demote an admin back to a regular user."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with email: {email}",
        )

    if user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{email} is not an admin.",
        )

    user.role = Role.USER
    await db.commit()
    await db.refresh(user)
    return user
