
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import DEMO_PROVIDER, DEMO_TEMPLATE_SUB, get_or_create_user
from app.demo.matchups import EXAMPLE_MATCHUPS
from app.demo.notes import EXAMPLE_NOTES
from app.models import AppUser, Match, Matchup, Note, NoteTag, Participant, Summoner
from app.services.linking import link_summoner

DATA_PATH = Path(__file__).with_name("data.json")

class DemoDataMissingError(RuntimeError):
    pass

def load_data(path: Path = DATA_PATH) -> dict:
    if not path.exists():
        raise DemoDataMissingError(
            f"No demo dataset at {path}. Run `python -m scripts.capture_demo` with a "
            "live RIOT_API_KEY to record one."
        )
    return json.loads(path.read_text(encoding="utf-8"))

def seed_demo(db: Session, path: Path = DATA_PATH) -> dict:
    data = load_data(path)
    puuid = data["summoner"]["puuid"]

    summoner = _upsert_summoner(db, data["summoner"])
    matches_new = _upsert_matches(db, data["matches"], puuid)
    db.commit()

    template = get_or_create_user(db, DEMO_PROVIDER, DEMO_TEMPLATE_SUB, None, "Demo")
    link_summoner(db, template, puuid)
    notes_new = _seed_example_notes(db, template, data["matches"], puuid)
    matchups_new = _seed_example_matchups(db, template)

    return {
        "puuid": puuid,
        "riot_id": f"{summoner.game_name}#{summoner.tag_line}",
        "matches_new": matches_new,
        "matches_total": len(data["matches"]),
        "notes_new": notes_new,
        "matchups_new": matchups_new,
        "template_user_id": str(template.id),
    }

def _seed_example_matchups(db: Session, template: AppUser) -> int:
    existing = {
        (m.role, m.your_champion_id, m.enemy_champion_id)
        for m in db.execute(select(Matchup).where(Matchup.user_id == template.id)).scalars()
    }
    added = 0
    for example in EXAMPLE_MATCHUPS:
        key = (example["role"], example["your_champion_id"], example["enemy_champion_id"])
        if key in existing:
            continue
        db.add(
            Matchup(
                user_id=template.id,
                role=example["role"],
                your_champion_id=example["your_champion_id"],
                enemy_champion_id=example["enemy_champion_id"],
                tags=example["tags"],
                weaknesses=example["weaknesses"],
                body=example["body"],
                loadout={
                    key: example[key]
                    for key in (
                        "core_item_ids",
                        "optional_item_ids",
                        "boot_item_id",
                        "optional_boot_item_id",
                        "runes",
                        "skill_order",
                    )
                },
            )
        )
        added += 1
    db.commit()
    return added

def _upsert_summoner(db: Session, row: dict) -> Summoner:
    summoner = db.get(Summoner, row["puuid"])
    if summoner is None:
        summoner = Summoner(puuid=row["puuid"])
        db.add(summoner)
    for key, value in row.items():
        if key != "puuid":
            setattr(summoner, key, value)
    summoner.last_synced_at = datetime.now(timezone.utc)
    return summoner

def _upsert_matches(db: Session, entries: list[dict], puuid: str) -> int:
    match_ids = [e["match"]["match_id"] for e in entries]
    have_matches = set(
        db.execute(select(Match.match_id).where(Match.match_id.in_(match_ids))).scalars().all()
    )
    have_participants = set(
        db.execute(
            select(Participant.match_id).where(
                Participant.match_id.in_(match_ids), Participant.puuid == puuid
            )
        )
        .scalars()
        .all()
    )

    added = 0
    for entry in entries:
        row = dict(entry["match"])
        match_id = row["match_id"]
        if match_id not in have_matches:
            row["game_creation"] = datetime.fromisoformat(row["game_creation"])
            db.add(Match(**row))
            added += 1
        if match_id not in have_participants:
            db.add(Participant(**entry["participant"]))
    return added

def _seed_example_notes(db: Session, template: AppUser, entries: list[dict], puuid: str) -> int:
    existing = db.execute(
        select(Note.match_id).where(Note.user_id == template.id, Note.puuid == puuid)
    ).scalars()
    already_noted = set(existing)

    added = 0
    for example in EXAMPLE_NOTES:
        index = example["index"]
        if index >= len(entries):
            continue
        match_id = entries[index]["match"]["match_id"]
        if match_id in already_noted:
            continue
        db.add(
            Note(
                user_id=template.id,
                match_id=match_id,
                puuid=puuid,
                body=example["body"],
                tags=[
                    NoteTag(tag_key=tag_key, phase=phase, timestamp_seconds=seconds)
                    for tag_key, phase, seconds in example["tags"]
                ],
            )
        )
        added += 1
    db.commit()
    return added

def main() -> None:
    from app.db import SessionLocal

    with SessionLocal() as db:
        result = seed_demo(db)
    print(
        f"Seeded demo {result['riot_id']}: "
        f"{result['matches_new']} new of {result['matches_total']} matches, "
        f"{result['notes_new']} new example notes, "
        f"{result['matchups_new']} new example matchups."
    )

if __name__ == "__main__":
    main()
