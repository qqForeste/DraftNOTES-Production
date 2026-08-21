from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_summoner, get_current_user, get_target_summoner
from app.models import AppUser, Summoner
from app.schemas.note import NoteTagOut
from app.schemas.stats import (
    ChampionSummary,
    LpHistoryPoint,
    LpHistoryResponse,
    PositionSummary,
    RecentNoteItem,
    TagChampionCount,
    TagCount,
    TagCountsResponse,
    TrendPoint,
    TrendResponse,
)
from app.services.aggregation import (
    count_games_considered,
    get_champion_summary,
    get_position_summary,
    get_recent_notes,
    get_tag_champion_counts,
    get_tag_counts,
    get_trend_points,
    summarize_trend,
)
from app.services.lp_history import average_lp_per_win, build_points, get_lp_history

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/tag-counts", response_model=TagCountsResponse)
def tag_counts(
    champion_id: int | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> TagCountsResponse:
    rows = get_tag_counts(db, user.id, summoner.puuid, champion_id, date_from, date_to)
    games = count_games_considered(db, summoner.puuid, champion_id, date_from, date_to)
    return TagCountsResponse(
        tag_counts=[TagCount(tag_key=tag_key, count=count) for tag_key, count in rows],
        games_considered=games,
    )

@router.get("/champions", response_model=list[ChampionSummary])
def champion_summary(
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_target_summoner),
    db: Session = Depends(get_db),
) -> list[ChampionSummary]:
    rows = get_champion_summary(db, user.id, summoner.puuid)
    return [
        ChampionSummary(
            champion_id=row.champion_id,
            games=row.games,
            wins=row.wins or 0,
            losses=row.games - (row.wins or 0),
            win_rate_pct=round(100 * (row.wins or 0) / row.games, 1) if row.games else 0.0,
            avg_kills=round(float(row.avg_kills), 1),
            avg_deaths=round(float(row.avg_deaths), 1),
            avg_assists=round(float(row.avg_assists), 1),
            note_count=row.note_count,
        )
        for row in rows
    ]

@router.get("/positions", response_model=list[PositionSummary])
def position_summary(
    summoner: Summoner = Depends(get_target_summoner),
    db: Session = Depends(get_db),
) -> list[PositionSummary]:
    rows = get_position_summary(db, summoner.puuid)
    total_games = count_games_considered(db, summoner.puuid)
    return [
        PositionSummary(
            team_position=row.team_position,
            games=row.games,
            wins=row.wins or 0,
            win_rate_pct=round(100 * (row.wins or 0) / row.games, 1) if row.games else 0.0,
            pick_rate_pct=round(100 * row.games / total_games, 1) if total_games else 0.0,
        )
        for row in rows
    ]

@router.get("/trend", response_model=TrendResponse)
def trend(
    count: int = Query(default=20, ge=1, le=100),
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> TrendResponse:
    points = get_trend_points(db, user.id, summoner.puuid, count)
    summary = summarize_trend(points)
    return TrendResponse(points=[TrendPoint(**p) for p in points], **summary)

@router.get("/recent-notes", response_model=list[RecentNoteItem])
def recent_notes(
    limit: int = Query(default=10, ge=1, le=200),
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> list[RecentNoteItem]:
    rows = get_recent_notes(db, user.id, summoner.puuid, limit)
    return [
        RecentNoteItem(
            match_id=note.match_id,
            champion_id=champion_id,
            win=win,
            game_creation=game_creation,
            body=note.body,
            tags=[NoteTagOut.model_validate(t) for t in note.tags],
        )
        for note, champion_id, win, game_creation in rows
    ]

@router.get("/tag-champions", response_model=list[TagChampionCount])
def tag_champions(
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> list[TagChampionCount]:
    rows = get_tag_champion_counts(db, user.id, summoner.puuid)
    return [
        TagChampionCount(tag_key=tag_key, champion_id=champion_id, count=count)
        for tag_key, champion_id, count in rows
    ]

@router.get("/lp-history", response_model=LpHistoryResponse)
def lp_history(
    queue: str = Query(default="solo", pattern="^(solo|flex)$"),
    limit: int = Query(default=500, ge=1, le=500),
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_target_summoner),
    db: Session = Depends(get_db),
) -> LpHistoryResponse:
    rows = get_lp_history(db, summoner.puuid, queue, limit)
    return LpHistoryResponse(
        queue=queue,
        points=[LpHistoryPoint(**p) for p in build_points(rows)],
        avg_lp_per_win=average_lp_per_win(rows),
    )
