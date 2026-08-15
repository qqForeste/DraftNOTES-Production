from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.note import NoteOut

class ScoreboardEntry(BaseModel):

    game_name: str
    champion_id: int
    team_id: int
    is_self: bool
    tag_line: str = ""
    tier: str | None = None
    division: str | None = None
    team_position: str | None = None
    champion_level: int = 0
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    cs: int = 0
    gold_earned: int = 0
    damage_dealt: int = 0
    items: list[int] = Field(default_factory=list)
    role_quest_item_id: int | None = None
    summoner_1_id: int | None = None
    summoner_2_id: int | None = None
    primary_rune_id: int | None = None
    secondary_style_id: int | None = None

class MatchListItem(BaseModel):
    match_id: str
    champion_id: int
    team_position: str | None
    win: bool
    kills: int
    deaths: int
    assists: int
    cs: int
    gold_earned: int
    game_duration: int
    game_creation: datetime
    queue_id: int
    patch: str

    items: list[int]
    summoner_1_id: int | None
    summoner_2_id: int | None
    primary_rune_id: int | None
    secondary_style_id: int | None
    champion_level: int | None
    double_kills: int
    triple_kills: int
    quadra_kills: int
    penta_kills: int
    wards_placed: int | None
    control_wards_purchased: int | None
    kill_participation_pct: float | None
    role_quest_item_id: int | None = None
    scoreboard: list[ScoreboardEntry]

    note: NoteOut | None

class MatchDetail(MatchListItem):
    cs_at_14: int | None
    gold_diff_at_14: int | None

class MatchPage(BaseModel):
    items: list[MatchListItem]
    next_cursor: str | None = None
