import glob
import json
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.dependencies import get_current_user, get_pinned_queue
from app.main import app
from app.models import (
    AppUser,
    Match,
    Note,
    NoteTag,
    Participant,
    PinnedUser,
    Summoner,
    UserSummoner,
)
from app.services.account import delete_account
from app.services.pinned import sync_pinned_user
from app.services.sync_queue import EnqueuedSync, PinnedJobState
from app.tags import GamePhase, MistakeTag

PLATFORM = "euw1"

def _fixture_match() -> dict:
    with open(sorted(glob.glob("fixtures/matches/*.json"))[0], encoding="utf-8") as fh:
        return json.load(fh)

@dataclass
class FakePinnedQueue:

    cooldown: int | None = None
    queue_depth: int = 0
    enqueued: list = None

    def __post_init__(self):
        self.enqueued = []

    async def claim_slot(self, user_id, platform, game_name, tag_line):
        return self.cooldown

    async def depth(self):
        return self.queue_depth

    async def enqueue(self, user_id, platform, game_name, tag_line):
        self.enqueued.append((user_id, platform, game_name, tag_line))
        return EnqueuedSync(job_id="job-1", queue_position=1)

    async def state(self, job_id):
        return PinnedJobState(job_id=job_id, status="complete", pinned_id=7)

@pytest.fixture()
def queue():
    return FakePinnedQueue()

@pytest.fixture()
def client(engine, db, queue):
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_pinned_queue] = lambda: queue
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture()
def signed_in(client):
    client.post("/api/auth/dev-login", json={"email": "pinner@example.com"})
    return client

PAYLOAD = {"game_name": "Faker", "tag_line": "KR1", "platform": PLATFORM}

class FakeRiot:
    def __init__(self, match_json, puuid, match_ids, entries=None):
        self.match_json = match_json
        self.puuid = puuid
        self.match_ids = match_ids
        self.entries = entries or []
        self.calls = 0

    async def get_account_by_riot_id(self, region, game_name, tag_line):
        self.calls += 1
        return {"puuid": self.puuid, "gameName": game_name, "tagLine": tag_line}

    async def get_league_entries_by_puuid(self, platform, puuid):
        self.calls += 1
        return self.entries

    async def get_ranked_match_ids(self, region, puuid, count=20):
        self.calls += 1
        return self.match_ids

    async def get_match(self, region, match_id):
        self.calls += 1
        return self.match_json

def test_sync_enqueues_and_never_calls_riot(signed_in, queue):
    resp = signed_in.post("/api/pinned/sync", json=PAYLOAD)
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued" and body["job_id"]
    assert len(queue.enqueued) == 1

def test_cooldown(signed_in, queue):
    queue.cooldown = 42
    resp = signed_in.post("/api/pinned/sync", json=PAYLOAD)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "42"

def test_a_full_queue_does_not_burn_the_cooldown(signed_in, queue):
    queue.queue_depth = 10_000
    assert signed_in.post("/api/pinned/sync", json=PAYLOAD).status_code == 503
    assert queue.enqueued == []

def test_unknown_platform_is_rejected(signed_in):
    resp = signed_in.post("/api/pinned/sync", json={**PAYLOAD, "platform": "mars1"})
    assert resp.status_code == 422

def test_demo_accounts_cannot_pin(client, db, queue):
    demo = AppUser(provider="demo", oauth_sub=str(uuid.uuid4()), email=None)
    db.add(demo)
    db.commit()
    app.dependency_overrides[get_current_user] = lambda: demo

    assert client.post("/api/pinned/sync", json=PAYLOAD).status_code == 403
    assert queue.enqueued == []

def test_requires_sign_in(client):
    assert client.get("/api/pinned").status_code == 401
    assert client.post("/api/pinned/sync", json=PAYLOAD).status_code == 401

async def test_worker_sync_creates_shared_rows(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][2]["puuid"]
    user = AppUser(provider="dev", oauth_sub="w@example.com", email="w@example.com")
    db.add(user)
    db.commit()

    riot = FakeRiot(data, puuid, [match_id])
    pinned = await sync_pinned_user(db, riot, user.id, PLATFORM, "Faker", "KR1")

    assert db.get(Summoner, puuid) is not None
    assert db.get(Participant, (match_id, puuid)) is not None
    assert pinned.synced_at is not None

    from app.services.pinned import to_out

    out = to_out(db, pinned)
    assert out.game_name == "Faker"
    assert len(out.recent_matches) == 1
    assert out.recent_matches[0].match_id == match_id

async def test_resyncing_preserves_the_id_and_note(db):
    data = _fixture_match()
    puuid = data["info"]["participants"][2]["puuid"]
    user = AppUser(provider="dev", oauth_sub="n@example.com", email="n@example.com")
    db.add(user)
    db.commit()

    riot = FakeRiot(data, puuid, [data["metadata"]["matchId"]])
    first = await sync_pinned_user(db, riot, user.id, PLATFORM, "Faker", "KR1")
    first.note = "duo partner"
    db.commit()

    again = await sync_pinned_user(db, riot, user.id, PLATFORM, "faker", "kr1")
    assert again.id == first.id
    assert again.note == "duo partner"
    assert len(db.execute(select(PinnedUser)).scalars().all()) == 1

def test_deleting_a_pinner_does_not_destroy_another_users_notes(db):
    puuid = "shared-puuid"
    pinner = AppUser(provider="dev", oauth_sub="p@example.com", email="p@example.com")
    owner = AppUser(provider="dev", oauth_sub="o@example.com", email="o@example.com")
    db.add_all([pinner, owner])
    db.add(Summoner(puuid=puuid, game_name="Faker", tag_line="KR1", region="asia"))
    db.commit()

    db.add(
        Match(
            match_id="KR_1",
            game_creation=datetime.now(timezone.utc),
            game_duration=1800,
            queue_id=420,
            patch="16.1",
        )
    )
    db.add(
        Participant(
            match_id="KR_1",
            puuid=puuid,
            champion_id=1,
            win=True,
            kills=1,
            deaths=1,
            assists=1,
            cs=1,
            gold_earned=1,
        )
    )
    db.commit()

    db.add(UserSummoner(user_id=owner.id, puuid=puuid, is_primary=True))
    db.add(PinnedUser(user_id=pinner.id, puuid=puuid))
    note = Note(user_id=owner.id, match_id="KR_1", puuid=puuid, body="mine")
    note.tags = [NoteTag(tag_key=MistakeTag.DIED_TO_GANK, phase=GamePhase.MID)]
    db.add(note)
    db.commit()

    delete_account(db, pinner.id)

    assert db.get(Summoner, puuid) is not None, "summoner survives, someone still links it"
    assert db.get(Match, "KR_1") is not None
    assert db.execute(select(Note).where(Note.user_id == owner.id)).scalar_one_or_none() is not None

def test_deleting_the_only_pinner_cleans_up(db):
    puuid = "lonely-puuid"
    pinner = AppUser(provider="dev", oauth_sub="only@example.com", email="only@example.com")
    db.add(pinner)
    db.add(Summoner(puuid=puuid, game_name="Nobody", tag_line="EUW", region="europe"))
    db.commit()
    db.add(PinnedUser(user_id=pinner.id, puuid=puuid))
    db.commit()

    result = delete_account(db, pinner.id)
    assert db.get(Summoner, puuid) is None
    assert result["summoners_removed"] == 1

def test_two_pinners_on_one_summoner_survive_a_deletion(db):
    puuid = "twice-pinned"
    a = AppUser(provider="dev", oauth_sub="a2@example.com", email="a2@example.com")
    b = AppUser(provider="dev", oauth_sub="b2@example.com", email="b2@example.com")
    db.add_all([a, b])
    db.add(Summoner(puuid=puuid, game_name="Streamer", tag_line="EUW", region="europe"))
    db.commit()
    db.add_all([PinnedUser(user_id=a.id, puuid=puuid), PinnedUser(user_id=b.id, puuid=puuid)])
    db.commit()

    delete_account(db, a.id)

    assert db.get(Summoner, puuid) is not None, "B still pins this player"
    assert (
        db.execute(select(PinnedUser).where(PinnedUser.user_id == b.id)).scalar_one_or_none()
        is not None
    )
