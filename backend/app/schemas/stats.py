from datetime import datetime

from pydantic import BaseModel

from app.schemas.note import NoteTagOut
from app.tags import MistakeTag

class TagCount(BaseModel):
    tag_key: MistakeTag
    count: int

class TagCountsResponse(BaseModel):
    tag_counts: list[TagCount]
    games_considered: int

class ChampionSummary(BaseModel):
    champion_id: int
    games: int
    wins: int
    losses: int
    win_rate_pct: float
    avg_kills: float
    avg_deaths: float
    avg_assists: float
    note_count: int

class PositionSummary(BaseModel):
    team_position: str | None
    games: int
    wins: int
    win_rate_pct: float
    pick_rate_pct: float

class TrendPoint(BaseModel):
    match_id: str
    game_creation: datetime
    win: bool
    tags: list[MistakeTag]

class TrendResponse(BaseModel):
    points: list[TrendPoint]
    tagged_games_last10: int
    tagged_games_prev10: int
    win_rate_in_noted_games_pct: float | None
    clean_games_streak: int

class RecentNoteItem(BaseModel):
    match_id: str
    champion_id: int
    win: bool
    game_creation: datetime
    body: str | None
    tags: list[NoteTagOut]

class TagChampionCount(BaseModel):
    tag_key: MistakeTag
    champion_id: int
    count: int

class LpHistoryPoint(BaseModel):
    captured_at: datetime
    tier: str | None
    division: str | None
    lp: int | None
    wins: int | None
    losses: int | None
    absolute_lp: int | None
    lp_delta: int | None
    games_delta: int | None

class LpHistoryResponse(BaseModel):
    queue: str
    points: list[LpHistoryPoint]
    avg_lp_per_win: float | None
