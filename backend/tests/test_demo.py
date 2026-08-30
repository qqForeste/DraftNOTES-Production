import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.auth import DEMO_PROVIDER, DEMO_TEMPLATE_SUB
from app.config import get_settings
from app.db import get_db
from app.demo.seed import seed_demo
from app.dependencies import get_redis
from app.main import app
from app.models import AppUser, Match, Note, Summoner
from app.services.demo import purge_expired_demo_users

DEMO_PUUID = "puuid-demo-test"
MATCH_COUNT = 4
SEEDED_NOTES = 3
UNTAGGED_MATCH = "KR_DEMO2"

@pytest.fixture()
def demo_data(tmp_path):
    created = datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc)
    data = {
        "riot_id": "Hide on bush#KR1",
        "summoner": {
            "puuid": DEMO_PUUID,
            "game_name": "Hide on bush",
            "tag_line": "KR1",
            "region": "asia",
            "platform": "kr",
            "solo_tier": "CHALLENGER",
            "solo_division": "I",
            "solo_lp": 1500,
            "solo_wins": 300,
            "solo_losses": 200,
            "flex_tier": None,
            "flex_division": None,
            "flex_lp": None,
            "flex_wins": None,
            "flex_losses": None,
        },
        "matches": [
            {
                "match": {
                    "match_id": f"KR_DEMO{i}",
                    "game_creation": (created - timedelta(hours=i)).isoformat(),
                    "game_duration": 1800,
                    "queue_id": 420,
                    "patch": "16.16",
                    "scoreboard": [
                        {
                            "game_name": "Hide on bush",
                            "champion_id": 103,
                            "team_id": 100,
                            "is_self": True,
                        }
                    ],
                },
                "participant": {
                    "match_id": f"KR_DEMO{i}",
                    "puuid": DEMO_PUUID,
                    "champion_id": 103,
                    "team_position": "MIDDLE",
                    "win": i % 2 == 0,
                    "kills": 5,
                    "deaths": 2,
                    "assists": 7,
                    "cs": 200,
                    "gold_earned": 12000,
                },
            }
            for i in range(MATCH_COUNT)
        ],
    }
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path

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
    app.dependency_overrides[get_redis] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture()
def seeded(db: Session, demo_data):
    return seed_demo(db, demo_data)

def test_seed_is_idempotent(db: Session, demo_data):
    first = seed_demo(db, demo_data)
    second = seed_demo(db, demo_data)
    assert (first["matches_new"], first["notes_new"]) == (MATCH_COUNT, SEEDED_NOTES)
    assert (second["matches_new"], second["notes_new"]) == (0, 0)
    assert len(db.execute(select(Match)).scalars().all()) == MATCH_COUNT

def test_demo_login_gives_a_linked_summoner_and_cloned_notes(client, seeded):
    resp = client.post("/api/auth/demo-login")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["provider"] == DEMO_PROVIDER
    assert [s["game_name"] for s in body["summoners"]] == ["Hide on bush"]
    assert body["summoners"][0]["is_primary"] is True

    matches = client.get("/api/matches").json()
    assert len(matches["items"]) == MATCH_COUNT
    assert sum(1 for m in matches["items"] if m["note"]) == SEEDED_NOTES
    assert client.get("/api/stats/tag-counts").json()["tag_counts"]

def test_demo_login_reuses_the_session(client, seeded, db: Session):
    first = client.post("/api/auth/demo-login").json()
    second = client.post("/api/auth/demo-login").json()
    assert first["id"] == second["id"]
    assert len(_visitors(db)) == 1

def test_each_visitor_gets_their_own_account(client, seeded, db: Session):
    client.post("/api/auth/demo-login")
    with TestClient(app) as other:
        other.post("/api/auth/demo-login")
    assert len(_visitors(db)) == 2

def test_demo_notes_are_private_to_each_visitor(client, seeded):
    client.post("/api/auth/demo-login")
    resp = client.put(
        f"/api/matches/{UNTAGGED_MATCH}/note",
        json={"body": "mine", "tags": [{"tag_key": "missed_wave", "phase": "early"}]},
    )
    assert resp.status_code == 200, resp.text

    with TestClient(app) as other:
        other.post("/api/auth/demo-login")
        assert other.get(f"/api/matches/{UNTAGGED_MATCH}").json()["note"] is None
        assert other.get("/api/matches/KR_DEMO0").json()["note"]["body"].startswith("Example note")

    assert client.get(f"/api/matches/{UNTAGGED_MATCH}").json()["note"]["body"] == "mine"

def test_demo_cannot_sync(client, seeded):
    client.post("/api/auth/demo-login")
    resp = client.post(
        "/api/summoners/sync",
        json={"game_name": "Someone", "tag_line": "EUW", "platform": "euw1"},
    )
    assert resp.status_code == 403

def test_providers_reports_demo_only_once_seeded(client, seeded):
    assert client.get("/api/auth/providers").json()["demo_enabled"] is True

def test_providers_hides_demo_and_login_503s_when_unseeded(client):
    assert client.get("/api/auth/providers").json()["demo_enabled"] is False
    assert client.post("/api/auth/demo-login").status_code == 503

def test_demo_login_404s_when_disabled(client, seeded, monkeypatch):
    monkeypatch.setattr(get_settings(), "demo_mode_enabled", False)
    assert client.post("/api/auth/demo-login").status_code == 404

def test_demo_login_rate_limits_per_ip(client, seeded):
    redis = _OneSlotRedis()
    app.dependency_overrides[get_redis] = lambda: redis
    assert client.post("/api/auth/demo-login").status_code == 200
    with TestClient(app) as other:
        resp = other.post("/api/auth/demo-login")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "30"

def test_demo_login_survives_redis_being_down(client, seeded):
    broken = _BrokenRedis()
    app.dependency_overrides[get_redis] = lambda: broken
    assert client.post("/api/auth/demo-login").status_code == 200

def test_deleting_a_demo_account_keeps_the_shared_demo_data(client, seeded, db: Session):
    client.post("/api/auth/demo-login")
    assert client.delete("/api/auth/me").status_code == 204

    assert db.get(Summoner, DEMO_PUUID) is not None
    assert len(db.execute(select(Match)).scalars().all()) == MATCH_COUNT
    assert len(db.execute(select(Note)).scalars().all()) == SEEDED_NOTES

def test_purge_removes_aged_demo_users_but_never_the_template(client, seeded, db: Session):
    user_id = uuid.UUID(client.post("/api/auth/demo-login").json()["id"])

    assert purge_expired_demo_users(db, ttl_days=7) == 0

    db.get(AppUser, user_id).created_at = datetime.now(timezone.utc) - timedelta(days=30)
    db.commit()

    assert purge_expired_demo_users(db, ttl_days=7) == 1
    assert db.get(AppUser, user_id) is None
    assert _template(db) is not None

def _visitors(db: Session) -> list[AppUser]:
    return list(
        db.execute(
            select(AppUser).where(
                AppUser.provider == DEMO_PROVIDER, AppUser.oauth_sub != DEMO_TEMPLATE_SUB
            )
        )
        .scalars()
        .all()
    )

def _template(db: Session) -> AppUser | None:
    return db.execute(
        select(AppUser).where(AppUser.oauth_sub == DEMO_TEMPLATE_SUB)
    ).scalar_one_or_none()

class _OneSlotRedis:

    def __init__(self):
        self.keys: set[str] = set()

    async def set(self, key, _value, ex=None, nx=False):
        if nx and key in self.keys:
            return None
        self.keys.add(key)
        return True

    async def ttl(self, _key):
        return 30

class _BrokenRedis:
    async def set(self, *_args, **_kwargs):
        raise ConnectionError("redis is down")
