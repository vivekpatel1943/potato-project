import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PushSubscription(Base):
    """A browser Web Push subscription.

    One user can have many (desktop browser + phone browser), which is why
    this lives in its own table rather than as a column on `users`.
    """
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # The Web Push subscription object returned by the browser
    endpoint: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    p256dh_key: Mapped[str] = mapped_column(String, nullable=False)  # encryption key
    auth_key: Mapped[str] = mapped_column(String, nullable=False)    # auth secret

    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
