from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

class Participant(Base):

    __tablename__ = "participant"
    __table_args__ = (Index("ix_participant_puuid", "puuid"),)

    match_id: Mapped[str] = mapped_column(
        ForeignKey("match.match_id", ondelete="CASCADE"), primary_key=True
    )
    puuid: Mapped[str] = mapped_column(
        ForeignKey("summoner.puuid", ondelete="CASCADE"), primary_key=True
    )

    champion_id: Mapped[int] = mapped_column(Integer, nullable=False)
    team_position: Mapped[str | None] = mapped_column(String(16))
    win: Mapped[bool] = mapped_column(Boolean, nullable=False)

    kills: Mapped[int] = mapped_column(Integer, nullable=False)
    deaths: Mapped[int] = mapped_column(Integer, nullable=False)
    assists: Mapped[int] = mapped_column(Integer, nullable=False)
    cs: Mapped[int] = mapped_column(Integer, nullable=False)
    gold_earned: Mapped[int] = mapped_column(Integer, nullable=False)

    cs_at_14: Mapped[int | None] = mapped_column(Integer)
    gold_diff_at_14: Mapped[int | None] = mapped_column(Integer)

    items: Mapped[list[int] | None] = mapped_column(ARRAY(Integer))
    summoner_1_id: Mapped[int | None] = mapped_column(Integer)
    summoner_2_id: Mapped[int | None] = mapped_column(Integer)
    primary_rune_id: Mapped[int | None] = mapped_column(Integer)
    secondary_style_id: Mapped[int | None] = mapped_column(Integer)
    champion_level: Mapped[int | None] = mapped_column(Integer)
    double_kills: Mapped[int | None] = mapped_column(Integer)
    triple_kills: Mapped[int | None] = mapped_column(Integer)
    quadra_kills: Mapped[int | None] = mapped_column(Integer)
    penta_kills: Mapped[int | None] = mapped_column(Integer)
    wards_placed: Mapped[int | None] = mapped_column(Integer)
    control_wards_purchased: Mapped[int | None] = mapped_column(Integer)
    kill_participation_pct: Mapped[float | None] = mapped_column(Float)
    profile_icon_id: Mapped[int | None] = mapped_column(Integer)
    role_quest_item_id: Mapped[int | None] = mapped_column(Integer)

    match: Mapped["Match"] = relationship(back_populates="participants")
    summoner: Mapped["Summoner"] = relationship(back_populates="participants")
    notes: Mapped[list["Note"]] = relationship(
        back_populates="participant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
