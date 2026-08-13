from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

class Match(Base):

    __tablename__ = "match"
    __table_args__ = (Index("ix_match_game_creation", "game_creation"),)

    match_id: Mapped[str] = mapped_column(String(24), primary_key=True)
    game_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    game_duration: Mapped[int] = mapped_column(Integer, nullable=False)
    queue_id: Mapped[int] = mapped_column(Integer, nullable=False)
    patch: Mapped[str] = mapped_column(String(16), nullable=False)

    scoreboard: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    winning_team_id: Mapped[int | None] = mapped_column(Integer)

    participants: Mapped[list["Participant"]] = relationship(
        back_populates="match", cascade="all, delete-orphan", passive_deletes=True
    )
