import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.auth import LEGACY_PROVIDER
from app.models import AppUser, Note, UserSummoner

def link_summoner(db: Session, user: AppUser, puuid: str) -> UserSummoner:
    _adopt_legacy_owner(db, user, puuid)

    link = db.get(UserSummoner, (user.id, puuid))
    if link is None:
        has_primary = db.execute(
            select(UserSummoner.puuid).where(
                UserSummoner.user_id == user.id, UserSummoner.is_primary.is_(True)
            )
        ).first()
        link = UserSummoner(user_id=user.id, puuid=puuid, is_primary=has_primary is None)
        db.add(link)
        db.commit()
        db.refresh(link)
    return link

def set_primary_summoner(db: Session, user: AppUser, puuid: str) -> None:
    db.execute(
        update(UserSummoner)
        .where(UserSummoner.user_id == user.id)
        .values(is_primary=UserSummoner.puuid == puuid)
    )
    db.commit()

def primary_puuid(db: Session, user_id: uuid.UUID) -> str | None:
    return db.execute(
        select(UserSummoner.puuid)
        .where(UserSummoner.user_id == user_id)
        .order_by(UserSummoner.is_primary.desc(), UserSummoner.linked_at.asc())
        .limit(1)
    ).scalar_one_or_none()

def _adopt_legacy_owner(db: Session, user: AppUser, puuid: str) -> None:
    legacy_id = db.execute(
        select(AppUser.id)
        .join(UserSummoner, UserSummoner.user_id == AppUser.id)
        .where(AppUser.provider == LEGACY_PROVIDER, UserSummoner.puuid == puuid)
    ).scalar_one_or_none()
    if legacy_id is None or legacy_id == user.id:
        return

    db.execute(update(Note).where(Note.user_id == legacy_id).values(user_id=user.id))
    if db.get(UserSummoner, (user.id, puuid)) is None:
        db.execute(
            update(UserSummoner)
            .where(UserSummoner.user_id == legacy_id, UserSummoner.puuid == puuid)
            .values(user_id=user.id, verified_at=datetime.now(timezone.utc))
        )
    else:
        db.execute(
            delete(UserSummoner).where(
                UserSummoner.user_id == legacy_id, UserSummoner.puuid == puuid
            )
        )
    db.execute(delete(AppUser).where(AppUser.id == legacy_id))
    db.commit()
    db.expire_all()
