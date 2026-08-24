from datetime import datetime, timedelta, timezone

from app.models import AppUser, Match, Note, NoteTag, Participant, Summoner
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
from app.tags import GamePhase, MistakeTag

PUUID = "puuid-agg"

def _seed(db):
    user = AppUser(provider="dev", oauth_sub="agg@example.com", email="agg@example.com")
    db.add(user)
    db.add(Summoner(puuid=PUUID, game_name="Faker", tag_line="KR1", region="asia"))

    def make_match(match_id: str, champion_id: int, days_ago: int) -> None:
        db.add(
            Match(
                match_id=match_id,
                game_creation=datetime.now(timezone.utc) - timedelta(days=days_ago),
                game_duration=1800,
                queue_id=420,
                patch="14.16",
            )
        )
        db.add(
            Participant(
                match_id=match_id,
                puuid=PUUID,
                champion_id=champion_id,
                team_position="MIDDLE",
                win=True,
                kills=5,
                deaths=2,
                assists=7,
                cs=180,
                gold_earned=12000,
            )
        )

    make_match("M1", champion_id=103, days_ago=1)
    make_match("M2", champion_id=103, days_ago=100)
    make_match("M3", champion_id=238, days_ago=2)
    db.commit()

    n1 = Note(user_id=user.id, match_id="M1", puuid=PUUID)
    n1.tags = [
        NoteTag(tag_key=MistakeTag.DIED_TO_GANK, phase=GamePhase.MID),
        NoteTag(tag_key=MistakeTag.MISSED_WAVE, phase=GamePhase.EARLY),
    ]
    n2 = Note(user_id=user.id, match_id="M2", puuid=PUUID)
    n2.tags = [NoteTag(tag_key=MistakeTag.DIED_TO_GANK, phase=GamePhase.LATE)]
    n3 = Note(user_id=user.id, match_id="M3", puuid=PUUID)
    n3.tags = [NoteTag(tag_key=MistakeTag.MECHANICAL_MISPLAY, phase=GamePhase.MID)]
    db.add_all([n1, n2, n3])
    db.commit()
    return user.id

def test_tag_counts_across_all_games(db):
    user_id = _seed(db)
    counts = dict(get_tag_counts(db, user_id, PUUID))
    assert counts[MistakeTag.DIED_TO_GANK] == 2
    assert counts[MistakeTag.MISSED_WAVE] == 1
    assert counts[MistakeTag.MECHANICAL_MISPLAY] == 1
    assert count_games_considered(db, PUUID) == 3

def test_tag_counts_filtered_by_champion(db):
    user_id = _seed(db)
    counts = dict(get_tag_counts(db, user_id, PUUID, champion_id=103))
    assert counts[MistakeTag.DIED_TO_GANK] == 2
    assert MistakeTag.MECHANICAL_MISPLAY not in counts
    assert count_games_considered(db, PUUID, champion_id=103) == 2

def test_tag_counts_filtered_by_date_range(db):
    user_id = _seed(db)
    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=10)
    counts = dict(get_tag_counts(db, user_id, PUUID, date_from=recent_cutoff))
    assert counts[MistakeTag.DIED_TO_GANK] == 1
    assert counts[MistakeTag.MISSED_WAVE] == 1
    assert counts[MistakeTag.MECHANICAL_MISPLAY] == 1
    assert count_games_considered(db, PUUID, date_from=recent_cutoff) == 2

def test_tag_counts_ignores_other_summoners(db):
    user_id = _seed(db)
    counts = dict(get_tag_counts(db, user_id, "someone-else"))
    assert counts == {}

def test_champion_summary_groups_by_champion(db):
    user_id = _seed(db)
    rows = {row.champion_id: row for row in get_champion_summary(db, user_id, PUUID)}
    assert rows[103].games == 2
    assert rows[103].wins == 2
    assert rows[103].note_count == 2
    assert rows[238].games == 1
    assert rows[238].note_count == 1

def test_position_summary_groups_by_team_position(db):
    user_id = _seed(db)
    rows = get_position_summary(db, PUUID)
    assert len(rows) == 1
    assert rows[0].team_position == "MIDDLE"
    assert rows[0].games == 3
    assert rows[0].wins == 3

def test_trend_points_oldest_to_newest_with_tags(db):
    user_id = _seed(db)
    points = get_trend_points(db, user_id, PUUID, count=20)
    assert [p["match_id"] for p in points] == ["M2", "M3", "M1"]
    assert points[0]["tags"] == [MistakeTag.DIED_TO_GANK]
    assert set(points[2]["tags"]) == {MistakeTag.DIED_TO_GANK, MistakeTag.MISSED_WAVE}

def test_summarize_trend_computes_streak_and_win_rate():
    points = [
        {"match_id": "a", "win": False, "tags": []},
        {"match_id": "b", "win": True, "tags": [MistakeTag.DIED_TO_GANK]},
        {"match_id": "c", "win": True, "tags": []},
        {"match_id": "d", "win": False, "tags": []},
    ]
    summary = summarize_trend(points)
    assert summary["tagged_games_last10"] == 1
    assert summary["tagged_games_prev10"] == 0
    assert summary["win_rate_in_noted_games_pct"] == 100.0
    assert summary["clean_games_streak"] == 2

def test_recent_notes_returns_newest_first_with_tags(db):
    user_id = _seed(db)
    rows = get_recent_notes(db, user_id, PUUID, limit=10)
    match_ids = [note.match_id for note, _, _, _ in rows]
    assert match_ids == ["M1", "M3", "M2"]
    note, champion_id, win, _ = rows[0]
    assert champion_id == 103
    assert win is True
    assert {t.tag_key for t in note.tags} == {MistakeTag.DIED_TO_GANK, MistakeTag.MISSED_WAVE}

def test_tag_champion_counts(db):
    user_id = _seed(db)
    rows = {(tag, champion): count for tag, champion, count in get_tag_champion_counts(db, user_id, PUUID)}
    assert rows[(MistakeTag.DIED_TO_GANK, 103)] == 2
    assert rows[(MistakeTag.MISSED_WAVE, 103)] == 1
    assert rows[(MistakeTag.MECHANICAL_MISPLAY, 238)] == 1
    assert (MistakeTag.DIED_TO_GANK, 238) not in rows

def test_tag_champion_counts_are_scoped_to_the_user(db):
    _seed(db)
    other = AppUser(provider="dev", oauth_sub="other@example.com", email="other@example.com")
    db.add(other)
    db.commit()
    assert get_tag_champion_counts(db, other.id, PUUID) == []
