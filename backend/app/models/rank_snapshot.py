from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

class RankSnapshot(Base):

    __tablename__ = "rank_snapshot"
    __table_args__ = (
        Index("ix_rank_snapshot_puuid_queue_captured", "puuid", "queue", "captured_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    puuid: Mapped[str] = mapped_column(
        String(78), ForeignKey("summoner.puuid", ondelete="CASCADE"), nullable=False
    )
    queue: Mapped[str] = mapped_column(String(8), nullable=False)
    tier: Mapped[str | None] = mapped_column(String(16))
    division: Mapped[str | None] = mapped_column(String(4))
    lp: Mapped[int | None] = mapped_column(Integer)
    wins: Mapped[int | None] = mapped_column(Integer)
    losses: Mapped[int | None] = mapped_column(Integer)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
