import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

class Note(Base):

    __tablename__ = "note"
    __table_args__ = (
        ForeignKeyConstraint(
            ["match_id", "puuid"],
            ["participant.match_id", "participant.puuid"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("user_id", "match_id", "puuid", name="uq_note_user_match_puuid"),
        Index("ix_note_puuid", "puuid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False
    )
    match_id: Mapped[str] = mapped_column(String(24), nullable=False)
    puuid: Mapped[str] = mapped_column(String(78), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    participant: Mapped["Participant"] = relationship(back_populates="notes")
    tags: Mapped[list["NoteTag"]] = relationship(
        back_populates="note", cascade="all, delete-orphan", passive_deletes=True
    )
