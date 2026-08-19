from datetime import datetime

from pydantic import BaseModel, Field

class PinnedUserMatch(BaseModel):
    match_id: str
    champion_id: int
    win: bool
    kills: int
    deaths: int
    assists: int
    queue_id: int
    game_creation: datetime
    game_duration: int

class PinnedUserOut(BaseModel):
    id: int
    game_name: str
    tag_line: str
    platform: str
    profile_icon_id: int
    tier: str | None
    division: str | None
    lp: int | None
    note: str | None
    synced_at: datetime
    recent_matches: list[PinnedUserMatch]

class PinnedSyncRequest(BaseModel):
    game_name: str = Field(min_length=1, max_length=64)
    tag_line: str = Field(min_length=1, max_length=16)
    platform: str

class PinnedNoteIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)

class PinnedSyncEnqueued(BaseModel):
    job_id: str
    status: str
    queue_position: int

class PinnedSyncJob(BaseModel):
    job_id: str
    status: str
    pinned_id: int | None = None
    error: str | None = None
