from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.tags import GamePhase, MistakeTag

class NoteTag(Base):

    __tablename__ = "note_tag"

    note_id: Mapped[int] = mapped_column(
        ForeignKey("note.id", ondelete="CASCADE"), primary_key=True
    )
    tag_key: Mapped[MistakeTag] = mapped_column(
        SAEnum(
            MistakeTag,
            name="mistake_tag",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        primary_key=True,
    )
    phase: Mapped[GamePhase] = mapped_column(
        SAEnum(
            GamePhase,
            name="game_phase",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    timestamp_seconds: Mapped[int | None] = mapped_column(Integer)

    note: Mapped["Note"] = relationship(back_populates="tags")
