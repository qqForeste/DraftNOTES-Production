import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

class AppUser(Base):

    __tablename__ = "app_user"
    __table_args__ = (UniqueConstraint("provider", "oauth_sub", name="uq_app_user_provider_sub"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    oauth_sub: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    summoners: Mapped[list["UserSummoner"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

class UserSummoner(Base):

    __tablename__ = "user_summoner"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="CASCADE"), primary_key=True
    )
    puuid: Mapped[str] = mapped_column(
        String(78), ForeignKey("summoner.puuid", ondelete="CASCADE"), primary_key=True
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["AppUser"] = relationship(back_populates="summoners")
    summoner: Mapped["Summoner"] = relationship()
