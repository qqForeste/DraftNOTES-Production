import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.matchup_tags import ITEM_SLOTS, SKILL_ORDER_LENGTH
from app.models import Matchup
from app.schemas.matchup import MatchupIn, MatchupOut, RunePage

LOADOUT_KEYS = (
    "core_item_ids",
    "optional_item_ids",
    "boot_item_id",
    "optional_boot_item_id",
    "runes",
    "skill_order",
)

def _empty_loadout() -> dict:
    return {
        "core_item_ids": [None] * ITEM_SLOTS,
        "optional_item_ids": [None] * ITEM_SLOTS,
        "boot_item_id": None,
        "optional_boot_item_id": None,
        "runes": RunePage().model_dump(),
        "skill_order": [None] * SKILL_ORDER_LENGTH,
    }

def _merge_loadout(existing: dict | None, payload: MatchupIn) -> dict:
    loadout = {**_empty_loadout(), **(existing or {})}
    for key in LOADOUT_KEYS:
        if key not in payload.model_fields_set:
            continue
        value = getattr(payload, key)
        loadout[key] = value.model_dump() if isinstance(value, RunePage) else value
    return loadout

def to_out(matchup: Matchup) -> MatchupOut:
    loadout = {**_empty_loadout(), **(matchup.loadout or {})}
    return MatchupOut(
        id=matchup.id,
        role=matchup.role,
        your_champion_id=matchup.your_champion_id,
        enemy_champion_id=matchup.enemy_champion_id,
        tags=matchup.tags,
        weaknesses=matchup.weaknesses,
        body=matchup.body,
        created_at=matchup.created_at,
        updated_at=matchup.updated_at,
        **loadout,
    )

def list_matchups(db: Session, user_id: uuid.UUID) -> list[Matchup]:
    return list(
        db.execute(
            select(Matchup)
            .where(Matchup.user_id == user_id)
            .order_by(Matchup.created_at.desc(), Matchup.id.desc())
        )
        .scalars()
        .all()
    )

def get_matchup(db: Session, user_id: uuid.UUID, matchup_id: int) -> Matchup | None:
    return db.execute(
        select(Matchup).where(Matchup.id == matchup_id, Matchup.user_id == user_id)
    ).scalar_one_or_none()

def find_pair(db: Session, user_id: uuid.UUID, payload: MatchupIn) -> Matchup | None:
    return db.execute(
        select(Matchup).where(
            Matchup.user_id == user_id,
            Matchup.role == payload.role.value,
            Matchup.your_champion_id == payload.your_champion_id,
            Matchup.enemy_champion_id == payload.enemy_champion_id,
        )
    ).scalar_one_or_none()

def _apply(matchup: Matchup, payload: MatchupIn) -> None:
    matchup.role = payload.role.value
    matchup.your_champion_id = payload.your_champion_id
    matchup.enemy_champion_id = payload.enemy_champion_id
    matchup.tags = [t.value for t in payload.tags]
    matchup.weaknesses = [w.value for w in payload.weaknesses]
    matchup.body = payload.body
    matchup.loadout = _merge_loadout(matchup.loadout, payload)

def create_matchup(db: Session, user_id: uuid.UUID, payload: MatchupIn) -> Matchup:
    matchup = Matchup(user_id=user_id)
    _apply(matchup, payload)
    db.add(matchup)
    db.commit()
    db.refresh(matchup)
    return matchup

def update_matchup(db: Session, matchup: Matchup, payload: MatchupIn) -> Matchup:
    _apply(matchup, payload)
    db.commit()
    db.refresh(matchup)
    return matchup

def delete_matchup(db: Session, matchup: Matchup) -> None:
    db.delete(matchup)
    db.commit()
