
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.auth import DEMO_PROVIDER, DEMO_TEMPLATE_SUB
from app.models import AppUser, Matchup, Note, NoteTag
from app.services.linking import link_summoner, primary_puuid

def find_demo_template(db: Session) -> AppUser | None:
    return db.execute(
        select(AppUser).where(
            AppUser.provider == DEMO_PROVIDER, AppUser.oauth_sub == DEMO_TEMPLATE_SUB
        )
    ).scalar_one_or_none()

def demo_summoner_puuid(db: Session) -> str | None:
    template = find_demo_template(db)
    return None if template is None else primary_puuid(db, template.id)

def create_demo_user(db: Session, puuid: str) -> AppUser:
    user = AppUser(
        provider=DEMO_PROVIDER,
        oauth_sub=uuid.uuid4().hex,
        display_name="Demo",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    link_summoner(db, user, puuid)
    return user

def clone_template_notes(db: Session, template: AppUser, target: AppUser, puuid: str) -> int:
    notes = (
        db.execute(
            select(Note)
            .where(Note.user_id == template.id, Note.puuid == puuid)
            .options(selectinload(Note.tags))
        )
        .scalars()
        .all()
    )
    for note in notes:
        db.add(
            Note(
                user_id=target.id,
                match_id=note.match_id,
                puuid=note.puuid,
                body=note.body,
                tags=[
                    NoteTag(
                        tag_key=tag.tag_key,
                        phase=tag.phase,
                        timestamp_seconds=tag.timestamp_seconds,
                    )
                    for tag in note.tags
                ],
            )
        )
    db.commit()
    return len(notes)

def clone_template_matchups(db: Session, template: AppUser, target: AppUser) -> int:
    matchups = (
        db.execute(select(Matchup).where(Matchup.user_id == template.id)).scalars().all()
    )
    for matchup in matchups:
        db.add(
            Matchup(
                user_id=target.id,
                role=matchup.role,
                your_champion_id=matchup.your_champion_id,
                enemy_champion_id=matchup.enemy_champion_id,
                tags=list(matchup.tags),
                weaknesses=list(matchup.weaknesses),
                body=matchup.body,
                loadout=dict(matchup.loadout or {}),
            )
        )
    db.commit()
    return len(matchups)

def purge_expired_demo_users(db: Session, ttl_days: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    ids = (
        db.execute(
            select(AppUser.id).where(
                AppUser.provider == DEMO_PROVIDER,
                AppUser.oauth_sub != DEMO_TEMPLATE_SUB,
                AppUser.created_at < cutoff,
            )
        )
        .scalars()
        .all()
    )
    if not ids:
        return 0
    db.execute(delete(AppUser).where(AppUser.id.in_(ids)))
    db.commit()
    return len(ids)
