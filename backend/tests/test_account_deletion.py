from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppUser, Match, Note, NoteTag, Participant, Summoner, UserSummoner
from app.services.account import delete_account
from app.tags import GamePhase, MistakeTag

PUUID = "puuid-deleteme"
OTHER_PUUID = "puuid-bystander"

def _user(db: Session, email: str) -> AppUser:
    user = AppUser(provider="dev", oauth_sub=email, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def _match(db: Session, match_id: str, puuid: str) -> None:
    if db.get(Match, match_id) is None:
        db.add(
            Match(
                match_id=match_id,
                game_creation=datetime.now(timezone.utc),
                game_duration=1800,
                queue_id=420,
                patch="14.16",
            )
        )
    db.add(
        Participant(
            match_id=match_id,
            puuid=puuid,
            champion_id=64,
            team_position="JUNGLE",
            win=True,
            kills=5,
            deaths=2,
            assists=7,
            cs=180,
            gold_earned=12000,
        )
    )
    db.commit()

def _note(db: Session, user: AppUser, match_id: str, puuid: str) -> int:
    note = Note(user_id=user.id, match_id=match_id, puuid=puuid, body="mine")
    note.tags = [NoteTag(tag_key=MistakeTag.DIED_TO_GANK, phase=GamePhase.MID)]
    db.add(note)
    db.commit()
    return note.id

@pytest.fixture()
def solo_account(db: Session):
    db.add(Summoner(puuid=PUUID, game_name="Solo", tag_line="EUW", region="europe"))
    db.commit()
    user = _user(db, "solo@example.com")
    db.add(UserSummoner(user_id=user.id, puuid=PUUID, is_primary=True))
    db.commit()
    _match(db, "DEL1", PUUID)
    note_id = _note(db, user, "DEL1", PUUID)
    return user, note_id

def test_deleting_an_account_removes_its_notes_and_tags(db: Session, solo_account):
    user, note_id = solo_account
    delete_account(db, user.id)

    assert db.get(AppUser, user.id) is None
    assert db.get(Note, note_id) is None
    assert db.get(NoteTag, (note_id, MistakeTag.DIED_TO_GANK)) is None
    assert db.execute(select(UserSummoner)).first() is None

def test_deleting_the_last_owner_removes_the_summoner_and_its_matches(db: Session, solo_account):
    user, _ = solo_account
    removed = delete_account(db, user.id)

    assert db.get(Summoner, PUUID) is None
    assert db.get(Participant, ("DEL1", PUUID)) is None
    assert db.get(Match, "DEL1") is None
    assert removed == {"summoners_removed": 1, "matches_removed": 1}

def test_a_summoner_someone_else_still_links_survives(db: Session):
    db.add(Summoner(puuid=PUUID, game_name="Shared", tag_line="EUW", region="europe"))
    db.commit()
    leaver = _user(db, "leaver@example.com")
    stayer = _user(db, "stayer@example.com")
    db.add_all(
        [
            UserSummoner(user_id=leaver.id, puuid=PUUID, is_primary=True),
            UserSummoner(user_id=stayer.id, puuid=PUUID, is_primary=True),
        ]
    )
    db.commit()
    _match(db, "DEL2", PUUID)
    leaver_note = _note(db, leaver, "DEL2", PUUID)
    stayer_note = _note(db, stayer, "DEL2", PUUID)

    removed = delete_account(db, leaver.id)

    assert db.get(Summoner, PUUID) is not None
    assert db.get(Match, "DEL2") is not None
    assert db.get(Note, leaver_note) is None
    assert db.get(Note, stayer_note) is not None
    assert removed == {"summoners_removed": 0, "matches_removed": 0}

def test_a_match_another_player_participated_in_survives(db: Session, solo_account):
    user, _ = solo_account
    bystander = _user(db, "bystander@example.com")
    db.add(Summoner(puuid=OTHER_PUUID, game_name="Bystander", tag_line="EUW", region="europe"))
    db.commit()
    db.add(UserSummoner(user_id=bystander.id, puuid=OTHER_PUUID, is_primary=True))
    db.commit()
    _match(db, "DEL1", OTHER_PUUID)

    delete_account(db, user.id)

    assert db.get(Match, "DEL1") is not None
    assert db.get(Participant, ("DEL1", OTHER_PUUID)) is not None
    assert db.get(Summoner, OTHER_PUUID) is not None

def test_deleting_an_account_with_nothing_linked_is_fine(db: Session):
    user = _user(db, "empty@example.com")
    assert delete_account(db, user.id) == {"summoners_removed": 0, "matches_removed": 0}
    assert db.get(AppUser, user.id) is None
