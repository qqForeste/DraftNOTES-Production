import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session, selectinload

from app.auth import DEMO_PROVIDER
from app.config import get_settings
from app.db import get_db
from app.dependencies import (
    get_current_summoner,
    get_current_user,
    get_older_matches_queue,
    get_target_summoner,
)
from app.models import AppUser, Match, Note, Participant, Summoner
from app.pagination import decode_cursor, encode_cursor
from app.riot.platforms import continent_for_platform
from app.schemas.match import MatchDetail, MatchListItem, MatchPage, ScoreboardEntry
from app.schemas.note import NoteOut
from app.schemas.older_matches import OlderMatchesEnqueued, OlderMatchesJob
from app.services.sync_queue import OlderMatchesQueue

router = APIRouter(prefix="/api/matches", tags=["matches"])

PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 100

def _match_fields(match: Match, participant: Participant, note: Note | None) -> dict:
    return dict(
        match_id=match.match_id,
        champion_id=participant.champion_id,
        team_position=participant.team_position,
        win=participant.win,
        kills=participant.kills,
        deaths=participant.deaths,
        assists=participant.assists,
        cs=participant.cs,
        gold_earned=participant.gold_earned,
        game_duration=match.game_duration,
        game_creation=match.game_creation,
        queue_id=match.queue_id,
        patch=match.patch,
        items=participant.items or [],
        summoner_1_id=participant.summoner_1_id,
        summoner_2_id=participant.summoner_2_id,
        primary_rune_id=participant.primary_rune_id,
        secondary_style_id=participant.secondary_style_id,
        champion_level=participant.champion_level,
        double_kills=participant.double_kills or 0,
        triple_kills=participant.triple_kills or 0,
        quadra_kills=participant.quadra_kills or 0,
        penta_kills=participant.penta_kills or 0,
        wards_placed=participant.wards_placed,
        control_wards_purchased=participant.control_wards_purchased,
        kill_participation_pct=participant.kill_participation_pct,
        role_quest_item_id=participant.role_quest_item_id,
        scoreboard=[ScoreboardEntry(**entry) for entry in (match.scoreboard or [])],
        note=NoteOut.model_validate(note) if note else None,
    )

def _notes_by_match(
    db: Session, user_id: uuid.UUID, puuid: str, match_ids: list[str]
) -> dict[str, Note]:
    if not match_ids:
        return {}
    rows = db.execute(
        select(Note)
        .where(Note.user_id == user_id, Note.puuid == puuid, Note.match_id.in_(match_ids))
        .options(selectinload(Note.tags))
    ).scalars()
    return {note.match_id: note for note in rows}

@router.get("", response_model=MatchPage)
def list_matches(
    limit: int = Query(default=PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    cursor: str | None = Query(default=None),
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_target_summoner),
    db: Session = Depends(get_db),
) -> MatchPage:
    stmt = (
        select(Match, Participant)
        .join(Participant, Participant.match_id == Match.match_id)
        .where(Participant.puuid == summoner.puuid)
        .order_by(Match.game_creation.desc(), Match.match_id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        after_creation, after_match_id = decode_cursor(cursor)
        stmt = stmt.where(
            tuple_(Match.game_creation, Match.match_id) < tuple_(after_creation, after_match_id)
        )

    rows = db.execute(stmt).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    notes = _notes_by_match(db, user.id, summoner.puuid, [match.match_id for match, _ in rows])
    last_match = rows[-1][0] if rows else None
    return MatchPage(
        items=[
            MatchListItem(**_match_fields(match, participant, notes.get(match.match_id)))
            for match, participant in rows
        ],
        next_cursor=(
            encode_cursor(last_match.game_creation, last_match.match_id)
            if has_more and last_match is not None
            else None
        ),
    )

@router.get("/{match_id}", response_model=MatchDetail)
def get_match(
    match_id: str,
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> MatchDetail:
    participant = db.get(Participant, (match_id, summoner.puuid))
    if participant is None:
        raise HTTPException(status_code=404, detail="Match not found for current summoner")
    match = db.get(Match, match_id)
    note = _notes_by_match(db, user.id, summoner.puuid, [match_id]).get(match_id)

    return MatchDetail(
        **_match_fields(match, participant, note),
        cs_at_14=participant.cs_at_14,
        gold_diff_at_14=participant.gold_diff_at_14,
    )

@router.post("/older", response_model=OlderMatchesEnqueued, status_code=202)
async def sync_older(
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_target_summoner),
    queue: OlderMatchesQueue = Depends(get_older_matches_queue),
) -> OlderMatchesEnqueued:
    if user.provider == DEMO_PROVIDER:
        raise HTTPException(status_code=403, detail="Loading more history is disabled in the demo.")
    if summoner.platform is None:
        raise HTTPException(status_code=422, detail="This account has no platform on record")
    settings = get_settings()

    depth = await queue.depth()
    if depth >= settings.sync_max_queue_depth:
        raise HTTPException(status_code=503, detail="Sync queue is full, try again shortly")

    retry_after = await queue.claim_slot(summoner.puuid)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Already loading more games for this account, try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )

    region = continent_for_platform(summoner.platform)
    enqueued = await queue.enqueue(summoner.puuid, region)
    return OlderMatchesEnqueued(
        job_id=enqueued.job_id, status="queued", queue_position=enqueued.queue_position
    )

@router.get("/older/{job_id}", response_model=OlderMatchesJob)
async def older_sync_job(
    job_id: str,
    user: AppUser = Depends(get_current_user),
    queue: OlderMatchesQueue = Depends(get_older_matches_queue),
) -> OlderMatchesJob:
    state = await queue.state(job_id)
    if state.status == "not_found":
        raise HTTPException(status_code=404, detail="Unknown job")
    return OlderMatchesJob(
        job_id=state.job_id,
        status=state.status,
        matches_new=state.matches_new,
        exhausted=state.exhausted,
        error=state.error,
    )
