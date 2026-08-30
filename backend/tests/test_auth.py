import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.auth import LEGACY_PROVIDER
from app.db import get_db
from app.main import app
from app.models import AppUser, Match, Note, NoteTag, Participant, Summoner, UserSummoner
from app.services.linking import link_summoner, primary_puuid
from app.tags import GamePhase, MistakeTag

PUUID = "puuid-shared-account"
PROTECTED = [
    ("get", "/api/matches"),
    ("get", "/api/matches/SHARED1"),
    ("get", "/api/summoners/me"),
    ("get", "/api/stats/tag-counts"),
    ("get", "/api/stats/champions"),
    ("get", "/api/stats/trend"),
    ("get", "/api/auth/me"),
]

@pytest.fixture()
def make_client(engine):
    TestSession = sessionmaker(bind=engine)
    created = []

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    def build() -> TestClient:
        client = TestClient(app)
        client.__enter__()
        created.append(client)
        return client

    yield build
    for client in created:
        client.__exit__(None, None, None)
    app.dependency_overrides.clear()

def sign_in(client: TestClient, email: str) -> uuid.UUID:
    resp = client.post("/api/auth/dev-login", json={"email": email})
    assert resp.status_code == 200, resp.text
    return uuid.UUID(resp.json()["id"])

@pytest.fixture()
def shared_match(db: Session):
    db.add(Summoner(puuid=PUUID, game_name="Shared", tag_line="EUW", region="europe"))
    db.add(
        Match(
            match_id="SHARED1",
            game_creation=datetime.now(timezone.utc),
            game_duration=1800,
            queue_id=420,
            patch="14.16",
        )
    )
    db.add(
        Participant(
            match_id="SHARED1",
            puuid=PUUID,
            champion_id=64,
            team_position="JUNGLE",
            win=True,
            kills=8,
            deaths=3,
            assists=9,
            cs=170,
            gold_earned=13000,
        )
    )
    db.commit()

@pytest.mark.parametrize("method, path", PROTECTED)
def test_every_data_route_needs_a_session(make_client, method, path):
    client = make_client()
    assert getattr(client, method)(path).status_code == 401

def test_signed_in_user_without_a_linked_riot_id_gets_404_not_someone_elses_data(
    make_client, db, shared_match
):
    client = make_client()
    sign_in(client, "nobody@example.com")
    assert client.get("/api/matches").status_code == 404

def test_two_users_on_the_same_riot_id_keep_separate_notes(make_client, db, shared_match):
    alice, bob = make_client(), make_client()
    alice_id = sign_in(alice, "alice@example.com")
    bob_id = sign_in(bob, "bob@example.com")
    db.add_all(
        [
            UserSummoner(user_id=alice_id, puuid=PUUID, is_primary=True),
            UserSummoner(user_id=bob_id, puuid=PUUID, is_primary=True),
        ]
    )
    db.commit()

    alice.put(
        "/api/matches/SHARED1/note",
        json={"body": "alice note", "tags": [{"tag_key": "died_to_gank", "phase": "mid"}]},
    ).raise_for_status()
    bob.put(
        "/api/matches/SHARED1/note",
        json={"body": "bob note", "tags": [{"tag_key": "missed_wave", "phase": "early"}]},
    ).raise_for_status()

    assert alice.get("/api/matches/SHARED1").json()["note"]["body"] == "alice note"
    assert bob.get("/api/matches/SHARED1").json()["note"]["body"] == "bob note"

    alice_tags = {r["tag_key"] for r in alice.get("/api/stats/tag-counts").json()["tag_counts"]}
    bob_tags = {r["tag_key"] for r in bob.get("/api/stats/tag-counts").json()["tag_counts"]}
    assert alice_tags == {"died_to_gank"}
    assert bob_tags == {"missed_wave"}

def test_deleting_a_note_leaves_the_other_users_note_alone(make_client, db, shared_match):
    alice, bob = make_client(), make_client()
    alice_id = sign_in(alice, "alice@example.com")
    bob_id = sign_in(bob, "bob@example.com")
    db.add_all(
        [
            UserSummoner(user_id=alice_id, puuid=PUUID, is_primary=True),
            UserSummoner(user_id=bob_id, puuid=PUUID, is_primary=True),
        ]
    )
    db.commit()

    for client, tag in ((alice, "died_to_gank"), (bob, "missed_wave")):
        client.put(
            "/api/matches/SHARED1/note",
            json={"tags": [{"tag_key": tag, "phase": "mid"}]},
        ).raise_for_status()

    assert alice.delete("/api/matches/SHARED1/note").status_code == 204
    assert alice.get("/api/matches/SHARED1").json()["note"] is None
    assert bob.get("/api/matches/SHARED1").json()["note"]["tags"][0]["tag_key"] == "missed_wave"

def test_logout_ends_the_session(make_client, db, shared_match):
    client = make_client()
    user_id = sign_in(client, "alice@example.com")
    db.add(UserSummoner(user_id=user_id, puuid=PUUID, is_primary=True))
    db.commit()

    assert client.get("/api/matches").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/matches").status_code == 401

def test_cookie_for_a_deleted_account_is_not_a_session(make_client, db, shared_match):
    client = make_client()
    user_id = sign_in(client, "alice@example.com")
    db.add(UserSummoner(user_id=user_id, puuid=PUUID, is_primary=True))
    db.commit()
    assert client.get("/api/matches").status_code == 200

    db.delete(db.get(AppUser, user_id))
    db.commit()
    assert client.get("/api/matches").status_code == 401

def test_first_real_login_adopts_the_legacy_accounts_notes(db: Session, shared_match):
    legacy = AppUser(provider=LEGACY_PROVIDER, oauth_sub=f"legacy:{PUUID}", display_name="Shared")
    db.add(legacy)
    db.commit()
    db.add(UserSummoner(user_id=legacy.id, puuid=PUUID, is_primary=True))
    note = Note(user_id=legacy.id, match_id="SHARED1", puuid=PUUID, body="written before accounts")
    note.tags = [NoteTag(tag_key=MistakeTag.DIED_TO_GANK, phase=GamePhase.MID)]
    db.add(note)
    db.commit()
    legacy_id = legacy.id

    real = AppUser(provider="dev", oauth_sub="owner@example.com", email="owner@example.com")
    db.add(real)
    db.commit()

    link_summoner(db, real, PUUID)

    assert db.get(AppUser, legacy_id) is None
    assert primary_puuid(db, real.id) == PUUID
    adopted = db.get(Note, note.id)
    assert adopted.user_id == real.id
    assert adopted.body == "written before accounts"
    assert {t.tag_key for t in adopted.tags} == {MistakeTag.DIED_TO_GANK}

def test_first_linked_riot_id_becomes_primary_and_later_ones_do_not(db: Session, shared_match):
    db.add(Summoner(puuid="puuid-smurf", game_name="Smurf", tag_line="EUW", region="europe"))
    user = AppUser(provider="dev", oauth_sub="multi@example.com")
    db.add_all([user])
    db.commit()

    first = link_summoner(db, user, PUUID)
    second = link_summoner(db, user, "puuid-smurf")
    assert first.is_primary is True
    assert second.is_primary is False
    assert primary_puuid(db, user.id) == PUUID

def test_providers_endpoint_reports_dev_login(make_client):
    body = make_client().get("/api/auth/providers").json()
    assert body["dev_login_enabled"] is True
    assert body["providers"] == []

def test_dev_login_is_gone_in_production(make_client, monkeypatch):
    from app.config import Settings
    from app.routers import auth as auth_router

    locked = Settings(_env_file=None, env="development")
    locked.dev_login_enabled = False
    monkeypatch.setattr(auth_router, "get_settings", lambda: locked)

    resp = make_client().post("/api/auth/dev-login", json={"email": "sneaky@example.com"})
    assert resp.status_code == 404

def test_deleting_the_account_ends_the_session(make_client, db, shared_match):
    client = make_client()
    user_id = sign_in(client, "goodbye@example.com")
    db.add(UserSummoner(user_id=user_id, puuid=PUUID, is_primary=True))
    db.commit()
    assert client.get("/api/matches").status_code == 200

    assert client.delete("/api/auth/me").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert db.get(AppUser, user_id) is None

def test_deleting_an_account_needs_a_session(make_client):
    assert make_client().delete("/api/auth/me").status_code == 401

def test_signing_in_again_after_deletion_is_a_fresh_account(make_client, db, shared_match):
    client = make_client()
    first_id = sign_in(client, "reborn@example.com")
    db.add(UserSummoner(user_id=first_id, puuid=PUUID, is_primary=True))
    db.commit()
    client.delete("/api/auth/me").raise_for_status()

    second_id = sign_in(client, "reborn@example.com")
    assert second_id != first_id
    assert client.get("/api/matches").status_code == 404
