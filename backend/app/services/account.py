import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import AppUser, Match, Participant, PinnedUser, Summoner, UserSummoner

def delete_account(db: Session, user_id: uuid.UUID) -> dict:
    puuids = list(
        db.execute(select(UserSummoner.puuid).where(UserSummoner.user_id == user_id)).scalars()
    )
    puuids += [
        p
        for p in db.execute(
            select(PinnedUser.puuid).where(PinnedUser.user_id == user_id)
        ).scalars()
        if p not in puuids
    ]

    db.execute(delete(AppUser).where(AppUser.id == user_id))
    db.flush()

    orphan_puuids = _unlinked(db, puuids)
    if orphan_puuids:
        db.execute(delete(Summoner).where(Summoner.puuid.in_(orphan_puuids)))
        db.flush()

    dead_matches = select(Match.match_id).outerjoin(
        Participant, Participant.match_id == Match.match_id
    ).where(Participant.match_id.is_(None))
    removed_matches = db.execute(
        delete(Match).where(Match.match_id.in_(dead_matches))
    ).rowcount
    db.commit()

    return {"summoners_removed": len(orphan_puuids), "matches_removed": removed_matches or 0}

def _unlinked(db: Session, puuids: list[str]) -> list[str]:
    if not puuids:
        return []
    still_referenced = set(
        db.execute(select(UserSummoner.puuid).where(UserSummoner.puuid.in_(puuids))).scalars()
    )
    still_referenced |= set(
        db.execute(select(PinnedUser.puuid).where(PinnedUser.puuid.in_(puuids))).scalars()
    )
    return [puuid for puuid in puuids if puuid not in still_referenced]
