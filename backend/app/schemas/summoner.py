from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.riot.platforms import PLATFORM_TO_CONTINENT

class SummonerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    puuid: str
    game_name: str
    tag_line: str
    region: str
    platform: str | None = None
    last_synced_at: datetime | None
    profile_icon_id: int | None = None

    solo_tier: str | None = None
    solo_division: str | None = None
    solo_lp: int | None = None
    solo_wins: int | None = None
    solo_losses: int | None = None

    flex_tier: str | None = None
    flex_division: str | None = None
    flex_lp: int | None = None
    flex_wins: int | None = None
    flex_losses: int | None = None

class SyncRequest(BaseModel):
    game_name: str
    tag_line: str
    platform: str

    @field_validator("platform")
    @classmethod
    def _known_platform(cls, value: str) -> str:
        if value not in PLATFORM_TO_CONTINENT:
            raise ValueError(f"Unknown platform {value!r}, expected one of {sorted(PLATFORM_TO_CONTINENT)}")
        return value

class SyncEnqueued(BaseModel):
    job_id: str
    status: str
    queue_position: int

class SyncJobOut(BaseModel):
    job_id: str
    status: str
    matches_seen: int | None = None
    matches_new: int | None = None
    error: str | None = None
