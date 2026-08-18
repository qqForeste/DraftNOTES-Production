import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.matchup_tags import MatchupPlaystyleTag, MatchupRole, MatchupWeaknessTag

def _in(values) -> str:
    return ", ".join(f"'{v.value}'" for v in values)

class Matchup(Base):

    __tablename__ = "matchup"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "role",
            "your_champion_id",
            "enemy_champion_id",
            name="uq_matchup_user_role_pair",
        ),
        CheckConstraint(f"role IN ({_in(MatchupRole)})", name="ck_matchup_role"),
        Index("ix_matchup_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(8), nullable=False)
    your_champion_id: Mapped[int] = mapped_column(Integer, nullable=False)
    enemy_champion_id: Mapped[int] = mapped_column(Integer, nullable=False)

    tags: Mapped[list[str]] = mapped_column(ARRAY(String(32)), nullable=False, default=list)
    weaknesses: Mapped[list[str]] = mapped_column(ARRAY(String(32)), nullable=False, default=list)
    body: Mapped[str | None] = mapped_column(Text)

    loadout: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
