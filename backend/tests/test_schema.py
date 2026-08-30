from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import AppUser, Match, Note, NoteTag, Participant, Summoner
from app.tags import GamePhase, MistakeTag

def _seed_match(db) -> tuple[AppUser, Summoner, Match, Participant]:
    user = AppUser(provider="dev", oauth_sub="schema@example.com")
    summoner = Summoner(
        puuid="puuid-1",
        game_name="Faker",
        tag_line="KR1",
        region="kr",
        last_synced_at=datetime.now(timezone.utc),
    )
    match = Match(
        match_id="KR_1234",
        game_creation=datetime.now(timezone.utc),
        game_duration=1800,
        queue_id=420,
        patch="14.16",
    )
    participant = Participant(
        match_id=match.match_id,
        puuid=summoner.puuid,
        champion_id=157,
        team_position="MIDDLE",
        win=True,
        kills=5,
        deaths=2,
        assists=7,
        cs=180,
        gold_earned=12000,
    )
    db.add_all([user, summoner, match, participant])
    db.commit()
    return user, summoner, match, participant

def test_note_with_tags_round_trips(db):
    user, summoner, match, participant = _seed_match(db)

    note = Note(user_id=user.id, match_id=match.match_id, puuid=summoner.puuid, body="Overextended mid.")
    note.tags = [
        NoteTag(tag_key=MistakeTag.OVEREXTENDED, phase=GamePhase.MID),
        NoteTag(tag_key=MistakeTag.DIED_TO_GANK, phase=GamePhase.MID, timestamp_seconds=740),
    ]
    db.add(note)
    db.commit()
    db.refresh(note)

    assert note.id is not None
    assert {t.tag_key for t in note.tags} == {
        MistakeTag.OVEREXTENDED,
        MistakeTag.DIED_TO_GANK,
    }
    assert db.get(NoteTag, (note.id, MistakeTag.DIED_TO_GANK)).timestamp_seconds == 740

def test_at_most_one_note_per_user_match_participant(db):
    user, summoner, match, _ = _seed_match(db)
    db.add(Note(user_id=user.id, match_id=match.match_id, puuid=summoner.puuid, body="first"))
    db.commit()

    db.add(Note(user_id=user.id, match_id=match.match_id, puuid=summoner.puuid, body="second"))
    with pytest.raises(IntegrityError):
        db.commit()

def test_deleting_participant_cascades_to_note_and_tags(db):
    user, summoner, match, participant = _seed_match(db)
    note = Note(user_id=user.id, match_id=match.match_id, puuid=summoner.puuid)
    note.tags = [NoteTag(tag_key=MistakeTag.MISSED_WAVE, phase=GamePhase.EARLY)]
    db.add(note)
    db.commit()
    note_id = note.id

    db.delete(participant)
    db.commit()

    assert db.get(Note, note_id) is None
    assert db.get(NoteTag, (note_id, MistakeTag.MISSED_WAVE)) is None
