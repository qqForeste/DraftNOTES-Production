from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.tags import GamePhase, MistakeTag

class NoteTagIn(BaseModel):
    tag_key: MistakeTag
    phase: GamePhase
    timestamp_seconds: int | None = None

class NoteIn(BaseModel):
    body: str | None = None
    tags: list[NoteTagIn] = Field(min_length=1, max_length=3)

class NoteTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tag_key: MistakeTag
    phase: GamePhase
    timestamp_seconds: int | None

class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    match_id: str
    puuid: str
    body: str | None
    created_at: datetime
    updated_at: datetime
    tags: list[NoteTagOut]
