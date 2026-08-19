import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

class PinnedUser(Base):

    __tablename__ = "pinned_user"
    __table_args__ = (
        UniqueConstraint("user_id", "puuid", name="uq_pinned_user_user_puuid"),
        Index("ix_pinned_user_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False
    )
    puuid: Mapped[str] = mapped_column(
        String(78), ForeignKey("summoner.puuid", ondelete="CASCADE"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    summoner: Mapped["Summoner"] = relationship()
