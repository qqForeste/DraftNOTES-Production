import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.db import get_db
from app.main import app
from app.models import Match, Participant, Summoner, UserSummoner

PUUID = "puuid-api-test"
EMAIL = "tester@example.com"

@pytest.fixture()
def client(engine):
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture()
def signed_in(client) -> uuid.UUID:
    resp = client.post("/api/auth/dev-login", json={"email": EMAIL})
    assert resp.status_code == 200, resp.text
    return uuid.UUID(resp.json()["id"])

@pytest.fixture()
def seeded_match(db: Session, signed_in: uuid.UUID):
    db.add(Summoner(puuid=PUUID, game_name="Faker", tag_line="KR1", region="asia"))
    db.add(
        Match(
            match_id="API1",
            game_creation=datetime.now(timezone.utc),
            game_duration=1800,
            queue_id=420,
            patch="14.16",
        )
    )
    db.add(
        Participant(
            match_id="API1",
            puuid=PUUID,
            champion_id=103,
            team_position="MIDDLE",
            win=True,
            kills=10,
            deaths=1,
            assists=5,
            cs=200,
            gold_earned=15000,
        )
    )
    db.commit()
    db.add(UserSummoner(user_id=signed_in, puuid=PUUID, is_primary=True))
    db.commit()

def test_list_matches_reflects_synced_data(client, seeded_match):
    resp = client.get("/api/matches")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["match_id"] == "API1"
    assert body["items"][0]["note"] is None
    assert body["next_cursor"] is None

def test_attach_note_then_see_it_in_match_detail_and_stats(client, seeded_match):
    resp = client.put(
        "/api/matches/API1/note",
        json={
            "body": "Overextended after first death.",
            "tags": [
                {"tag_key": "died_to_gank", "phase": "mid"},
                {"tag_key": "tilted", "phase": "mid", "timestamp_seconds": 900},
            ],
        },
    )
    assert resp.status_code == 200
    assert {t["tag_key"] for t in resp.json()["tags"]} == {"died_to_gank", "tilted"}

    detail = client.get("/api/matches/API1").json()
    assert detail["note"]["body"] == "Overextended after first death."
    assert len(detail["note"]["tags"]) == 2

    stats = client.get("/api/stats/tag-counts").json()
    counts = {row["tag_key"]: row["count"] for row in stats["tag_counts"]}
    assert counts == {"died_to_gank": 1, "tilted": 1}
    assert stats["games_considered"] == 1

def test_editing_a_note_replaces_its_tags_not_appends(client, seeded_match):
    client.put(
        "/api/matches/API1/note",
        json={"tags": [{"tag_key": "missed_wave", "phase": "early"}]},
    )
    resp = client.put(
        "/api/matches/API1/note",
        json={"tags": [{"tag_key": "no_map_awareness", "phase": "late"}]},
    )
    tags = {t["tag_key"] for t in resp.json()["tags"]}
    assert tags == {"no_map_awareness"}

def test_note_on_unknown_match_is_404(client, seeded_match):
    resp = client.put(
        "/api/matches/does-not-exist/note",
        json={"tags": [{"tag_key": "missed_wave", "phase": "early"}]},
    )
    assert resp.status_code == 404

def test_matches_endpoint_401s_when_signed_out(client):
    assert client.get("/api/matches").status_code == 401

def test_matches_endpoint_404s_before_linking_a_riot_id(client, signed_in):
    resp = client.get("/api/matches")
    assert resp.status_code == 404

def test_delete_note_clears_it(client, seeded_match):
    client.put(
        "/api/matches/API1/note",
        json={"tags": [{"tag_key": "missed_wave", "phase": "early"}]},
    )
    resp = client.delete("/api/matches/API1/note")
    assert resp.status_code == 204

    detail = client.get("/api/matches/API1").json()
    assert detail["note"] is None

def test_delete_note_on_untagged_match_is_a_noop(client, seeded_match):
    resp = client.delete("/api/matches/API1/note")
    assert resp.status_code == 204

@pytest.fixture()
def many_matches(db: Session, signed_in: uuid.UUID):
    db.add(Summoner(puuid=PUUID, game_name="Faker", tag_line="KR1", region="asia"))
    base = datetime(2026, 8, 1, tzinfo=timezone.utc)
    for i in range(25):
        db.add(
            Match(
                match_id=f"PAGE{i:02d}",
                game_creation=base + timedelta(minutes=i),
                game_duration=1800,
                queue_id=420,
                patch="14.16",
            )
        )
        db.add(
            Participant(
                match_id=f"PAGE{i:02d}",
                puuid=PUUID,
                champion_id=103,
                team_position="MIDDLE",
                win=i % 2 == 0,
                kills=i,
                deaths=1,
                assists=5,
                cs=200,
                gold_earned=15000,
            )
        )
    db.commit()
    db.add(UserSummoner(user_id=signed_in, puuid=PUUID, is_primary=True))
    db.commit()

def test_list_matches_defaults_to_one_page(client, many_matches):
    body = client.get("/api/matches").json()
    assert len(body["items"]) == 20
    assert body["next_cursor"] is not None
    assert body["items"][0]["match_id"] == "PAGE24"

def test_cursor_walks_every_match_exactly_once(client, many_matches):
    seen = []
    cursor = None
    for _ in range(10):
        query = f"?limit=7&cursor={cursor}" if cursor else "?limit=7"
        body = client.get(f"/api/matches{query}").json()
        seen.extend(m["match_id"] for m in body["items"])
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert cursor is None
    assert len(seen) == len(set(seen)) == 25
    assert seen == sorted(seen, reverse=True)

def test_last_page_has_no_cursor(client, many_matches):
    body = client.get("/api/matches?limit=25").json()
    assert len(body["items"]) == 25
    assert body["next_cursor"] is None

def test_garbage_cursor_is_rejected(client, many_matches):
    assert client.get("/api/matches?cursor=not-a-cursor").status_code == 400

def test_limit_above_max_is_rejected(client, many_matches):
    assert client.get("/api/matches?limit=500").status_code == 422
