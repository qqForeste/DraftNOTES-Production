import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Match, Note, NoteTag, Participant
from app.tags import MistakeTag

def get_tag_counts(
    db: Session,
    user_id: uuid.UUID,
    puuid: str,
    champion_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[tuple[MistakeTag, int]]:
    stmt = (
        select(NoteTag.tag_key, func.count().label("tag_count"))
        .join(Note, Note.id == NoteTag.note_id)
        .join(
            Participant,
            (Participant.match_id == Note.match_id) & (Participant.puuid == Note.puuid),
        )
        .join(Match, Match.match_id == Participant.match_id)
        .where(Note.user_id == user_id, Note.puuid == puuid)
        .group_by(NoteTag.tag_key)
        .order_by(func.count().desc())
    )
    if champion_id is not None:
        stmt = stmt.where(Participant.champion_id == champion_id)
    if date_from is not None:
        stmt = stmt.where(Match.game_creation >= date_from)
    if date_to is not None:
        stmt = stmt.where(Match.game_creation <= date_to)

    return list(db.execute(stmt).all())

def get_tag_champion_counts(
    db: Session,
    user_id: uuid.UUID,
    puuid: str,
) -> list[tuple[MistakeTag, int, int]]:
    stmt = (
        select(NoteTag.tag_key, Participant.champion_id, func.count().label("tag_count"))
        .join(Note, Note.id == NoteTag.note_id)
        .join(
            Participant,
            (Participant.match_id == Note.match_id) & (Participant.puuid == Note.puuid),
        )
        .where(Note.user_id == user_id, Note.puuid == puuid)
        .group_by(NoteTag.tag_key, Participant.champion_id)
        .order_by(func.count().desc())
    )
    return list(db.execute(stmt).all())

def count_games_considered(
    db: Session,
    puuid: str,
    champion_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> int:
    stmt = select(func.count()).select_from(Participant).join(
        Match, Match.match_id == Participant.match_id
    ).where(Participant.puuid == puuid)
    if champion_id is not None:
        stmt = stmt.where(Participant.champion_id == champion_id)
    if date_from is not None:
        stmt = stmt.where(Match.game_creation >= date_from)
    if date_to is not None:
        stmt = stmt.where(Match.game_creation <= date_to)
    return db.execute(stmt).scalar_one()

def get_latest_profile_icon_id(db: Session, puuid: str) -> int | None:
    stmt = (
        select(Participant.profile_icon_id)
        .join(Match, Match.match_id == Participant.match_id)
        .where(Participant.puuid == puuid)
        .order_by(Match.game_creation.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()

def get_champion_summary(db: Session, user_id: uuid.UUID, puuid: str) -> list[Any]:
    stmt = (
        select(
            Participant.champion_id,
            func.count().label("games"),
            func.sum(cast(Participant.win, Integer)).label("wins"),
            func.avg(Participant.kills).label("avg_kills"),
            func.avg(Participant.deaths).label("avg_deaths"),
            func.avg(Participant.assists).label("avg_assists"),
            func.count(Note.id).label("note_count"),
        )
        .outerjoin(
            Note,
            (Note.match_id == Participant.match_id)
            & (Note.puuid == Participant.puuid)
            & (Note.user_id == user_id),
        )
        .where(Participant.puuid == puuid)
        .group_by(Participant.champion_id)
        .order_by(func.count().desc())
    )
    return list(db.execute(stmt).all())

def get_position_summary(db: Session, puuid: str) -> list[Any]:
    stmt = (
        select(
            Participant.team_position,
            func.count().label("games"),
            func.sum(cast(Participant.win, Integer)).label("wins"),
        )
        .where(Participant.puuid == puuid)
        .group_by(Participant.team_position)
        .order_by(func.count().desc())
    )
    return list(db.execute(stmt).all())

def get_trend_points(
    db: Session, user_id: uuid.UUID, puuid: str, count: int = 20
) -> list[dict[str, Any]]:
    stmt = (
        select(Match.match_id, Match.game_creation, Participant.win)
        .join(Participant, Participant.match_id == Match.match_id)
        .where(Participant.puuid == puuid)
        .order_by(Match.game_creation.desc())
        .limit(count)
    )
    rows = db.execute(stmt).all()
    match_ids = [row.match_id for row in rows]

    tags_by_match: dict[str, list[MistakeTag]] = {}
    if match_ids:
        tag_rows = db.execute(
            select(Note.match_id, NoteTag.tag_key)
            .join(NoteTag, NoteTag.note_id == Note.id)
            .where(Note.user_id == user_id, Note.puuid == puuid, Note.match_id.in_(match_ids))
        ).all()
        for match_id, tag_key in tag_rows:
            tags_by_match.setdefault(match_id, []).append(tag_key)

    points = [
        {
            "match_id": row.match_id,
            "game_creation": row.game_creation,
            "win": row.win,
            "tags": tags_by_match.get(row.match_id, []),
        }
        for row in rows
    ]
    return list(reversed(points))

def summarize_trend(points: list[dict[str, Any]]) -> dict[str, Any]:
    last10 = points[-10:]
    prev10 = points[-20:-10]
    tagged_games_last10 = sum(1 for p in last10 if p["tags"])
    tagged_games_prev10 = sum(1 for p in prev10 if p["tags"])

    noted = [p for p in points if p["tags"]]
    win_rate_in_noted_games_pct = (
        round(100 * sum(1 for p in noted if p["win"]) / len(noted), 1) if noted else None
    )

    clean_games_streak = 0
    for p in reversed(points):
        if p["tags"]:
            break
        clean_games_streak += 1

    return {
        "tagged_games_last10": tagged_games_last10,
        "tagged_games_prev10": tagged_games_prev10,
        "win_rate_in_noted_games_pct": win_rate_in_noted_games_pct,
        "clean_games_streak": clean_games_streak,
    }

def get_recent_notes(db: Session, user_id: uuid.UUID, puuid: str, limit: int = 10) -> list[Any]:
    stmt = (
        select(Note, Participant.champion_id, Participant.win, Match.game_creation)
        .join(
            Participant,
            (Participant.match_id == Note.match_id) & (Participant.puuid == Note.puuid),
        )
        .join(Match, Match.match_id == Note.match_id)
        .where(Note.user_id == user_id, Note.puuid == puuid)
        .order_by(Match.game_creation.desc())
        .limit(limit)
        .options(selectinload(Note.tags))
    )
    return list(db.execute(stmt).all())
