from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

class Summoner(Base):

    __tablename__ = "summoner"

    puuid: Mapped[str] = mapped_column(String(78), primary_key=True)
    game_name: Mapped[str] = mapped_column(String(64), nullable=False)
    tag_line: Mapped[str] = mapped_column(String(16), nullable=False)
    region: Mapped[str] = mapped_column(String(16), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(8))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rank_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    solo_tier: Mapped[str | None] = mapped_column(String(16))
    solo_division: Mapped[str | None] = mapped_column(String(4))
    solo_lp: Mapped[int | None] = mapped_column(Integer)
    solo_wins: Mapped[int | None] = mapped_column(Integer)
    solo_losses: Mapped[int | None] = mapped_column(Integer)

    flex_tier: Mapped[str | None] = mapped_column(String(16))
    flex_division: Mapped[str | None] = mapped_column(String(4))
    flex_lp: Mapped[int | None] = mapped_column(Integer)
    flex_wins: Mapped[int | None] = mapped_column(Integer)
    flex_losses: Mapped[int | None] = mapped_column(Integer)

    participants: Mapped[list["Participant"]] = relationship(
        back_populates="summoner", cascade="all, delete-orphan", passive_deletes=True
    )
