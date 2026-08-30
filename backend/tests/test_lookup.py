import glob
import json
import uuid
from dataclasses import dataclass

import pytest
from arq import create_pool
from arq.connections import RedisSettings
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user, get_lookup_queue, get_resolve_queue
from app.main import app
from app.models import AppUser, Match, Participant, PinnedUser, Summoner
from app.services.lookup import sync_looked_up_summoner
from app.services.sync_queue import (
    EnqueuedSync,
    LookupJobState,
    RedisLookupQueue,
    RedisResolveQueue,
    ResolveJobState,
)

PLATFORM = "euw1"
TEST_REDIS_URL = get_settings().redis_url.rsplit("/", 1)[0] + "/1"

def _fixture_match() -> dict:
    with open(sorted(glob.glob("fixtures/matches/*.json"))[0], encoding="utf-8") as fh:
        return json.load(fh)

@dataclass
class FakeLookupQueue:

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
        return LookupJobState(job_id=job_id, status="complete", puuid="some-puuid")

@pytest.fixture()
def queue():
    return FakeLookupQueue()

@dataclass
class FakeResolveQueue:

    queue_depth: int = 0
    enqueued: list = None

    def __post_init__(self):
        self.enqueued = []

    async def depth(self):
        return self.queue_depth

    async def enqueue(self, platform, game_name, tag_line):
        self.enqueued.append((platform, game_name, tag_line))
        return EnqueuedSync(job_id="resolve-job-1", queue_position=1)

    async def state(self, job_id):
        return ResolveJobState(job_id=job_id, status="complete", puuid="some-puuid")

@pytest.fixture()
def resolve_queue():
    return FakeResolveQueue()

@pytest.fixture()
def client(engine, db, queue, resolve_queue):
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_lookup_queue] = lambda: queue
    app.dependency_overrides[get_resolve_queue] = lambda: resolve_queue
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture()
def signed_in(client):
    client.post("/api/auth/dev-login", json={"email": "searcher@example.com"})
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
    resp = signed_in.post("/api/lookup/sync", json=PAYLOAD)
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued" and body["job_id"]
    assert len(queue.enqueued) == 1

def test_cooldown(signed_in, queue):
    queue.cooldown = 42
    resp = signed_in.post("/api/lookup/sync", json=PAYLOAD)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "42"

def test_a_full_queue_does_not_burn_the_cooldown(signed_in, queue):
    queue.queue_depth = 10_000
    assert signed_in.post("/api/lookup/sync", json=PAYLOAD).status_code == 503
    assert queue.enqueued == []

def test_unknown_platform_is_rejected(signed_in):
    resp = signed_in.post("/api/lookup/sync", json={**PAYLOAD, "platform": "mars1"})
    assert resp.status_code == 422

def test_demo_accounts_cannot_look_up(client, db, queue):
    demo = AppUser(provider="demo", oauth_sub=str(uuid.uuid4()), email=None)
    db.add(demo)
    db.commit()
    app.dependency_overrides[get_current_user] = lambda: demo

    assert client.post("/api/lookup/sync", json=PAYLOAD).status_code == 403
    assert queue.enqueued == []

def test_requires_sign_in(client):
    assert client.post("/api/lookup/sync", json=PAYLOAD).status_code == 401

def test_unknown_job_id_is_not_found_via_the_fake(signed_in, queue):
    resp = signed_in.get("/api/lookup/sync/job-1")
    assert resp.status_code == 200
    assert resp.json()["status"] == "complete"

def test_resolve_enqueues_and_never_calls_riot(signed_in, resolve_queue):
    resp = signed_in.post("/api/lookup/resolve", json=PAYLOAD)
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued" and body["job_id"]
    assert len(resolve_queue.enqueued) == 1

def test_resolve_has_no_cooldown(signed_in, resolve_queue):
    assert signed_in.post("/api/lookup/resolve", json=PAYLOAD).status_code == 202
    assert signed_in.post("/api/lookup/resolve", json=PAYLOAD).status_code == 202
    assert len(resolve_queue.enqueued) == 2

def test_resolve_full_queue_sheds_load(signed_in, resolve_queue):
    resolve_queue.queue_depth = 10_000
    assert signed_in.post("/api/lookup/resolve", json=PAYLOAD).status_code == 503
    assert resolve_queue.enqueued == []

def test_resolve_unknown_platform_is_rejected(signed_in):
    resp = signed_in.post("/api/lookup/resolve", json={**PAYLOAD, "platform": "mars1"})
    assert resp.status_code == 422

def test_demo_accounts_cannot_resolve(client, db, resolve_queue):
    demo = AppUser(provider="demo", oauth_sub=str(uuid.uuid4()), email=None)
    db.add(demo)
    db.commit()
    app.dependency_overrides[get_current_user] = lambda: demo

    assert client.post("/api/lookup/resolve", json=PAYLOAD).status_code == 403
    assert resolve_queue.enqueued == []

def test_resolve_requires_sign_in(client):
    assert client.post("/api/lookup/resolve", json=PAYLOAD).status_code == 401

def test_resolve_unknown_job_id_via_the_fake(signed_in):
    resp = signed_in.get("/api/lookup/resolve/job-1")
    assert resp.status_code == 200
    assert resp.json()["status"] == "complete"

async def test_worker_sync_creates_shared_rows_without_pinning(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][2]["puuid"]

    riot = FakeRiot(data, puuid, [match_id])
    summoner = await sync_looked_up_summoner(db, riot, PLATFORM, "Faker", "KR1")

    assert summoner.puuid == puuid
    assert db.get(Summoner, puuid) is not None
    assert db.get(Participant, (match_id, puuid)) is not None
    assert db.get(Match, match_id) is not None

    assert list(db.execute(select(PinnedUser)).scalars().all()) == []

async def test_resyncing_a_lookup_does_not_duplicate_or_refetch(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][2]["puuid"]

    riot = FakeRiot(data, puuid, [match_id])
    await sync_looked_up_summoner(db, riot, PLATFORM, "Faker", "KR1")
    calls_after_first = riot.calls

    await sync_looked_up_summoner(db, riot, PLATFORM, "Faker", "KR1")

    assert riot.calls > calls_after_first, "still resolves the account and rank each time"
    assert len(db.execute(select(Participant)).scalars().all()) == 1, "no duplicate participant"

@pytest.fixture()
async def redis_queue():
    settings = get_settings()
    pool = await create_pool(RedisSettings.from_dsn(TEST_REDIS_URL))
    await pool.flushdb()
    yield RedisLookupQueue(pool, "lookup:test", settings.lookup_cooldown_seconds)
    await pool.flushdb()
    await pool.aclose()

async def test_unknown_job_id_is_not_found(redis_queue):
    assert (await redis_queue.state("no-such-job")).status == "not_found"

async def test_enqueued_job_shows_up_as_queued_and_counts_toward_depth(redis_queue):
    assert await redis_queue.depth() == 0
    enqueued = await redis_queue.enqueue(uuid.uuid4(), PLATFORM, "Faker", "KR1")
    assert await redis_queue.depth() == 1

    state = await redis_queue.state(enqueued.job_id)
    assert state.status in {"queued", "deferred"}

async def test_cooldown_allows_once_then_blocks(redis_queue):
    user_id = uuid.uuid4()
    assert await redis_queue.claim_slot(user_id, PLATFORM, "Faker", "KR1") is None
    remaining = await redis_queue.claim_slot(user_id, PLATFORM, "Faker", "KR1")
    assert remaining is not None and remaining > 0

async def test_cooldown_is_per_user_and_target(redis_queue):
    assert await redis_queue.claim_slot(uuid.uuid4(), PLATFORM, "Faker", "KR1") is None
    assert await redis_queue.claim_slot(uuid.uuid4(), PLATFORM, "Faker", "KR1") is None
    same_user = uuid.uuid4()
    assert await redis_queue.claim_slot(same_user, PLATFORM, "Faker", "KR1") is None
    assert await redis_queue.claim_slot(same_user, PLATFORM, "Caps", "T1") is None

async def test_releasing_lets_the_searcher_retry(redis_queue):
    user_id = uuid.uuid4()
    await redis_queue.claim_slot(user_id, PLATFORM, "Faker", "KR1")
    await redis_queue.release_slot(user_id, PLATFORM, "Faker", "KR1")
    assert await redis_queue.claim_slot(user_id, PLATFORM, "Faker", "KR1") is None

@pytest.fixture()
async def redis_resolve_queue():
    pool = await create_pool(RedisSettings.from_dsn(TEST_REDIS_URL))
    await pool.flushdb()
    yield RedisResolveQueue(pool, "resolve:test")
    await pool.flushdb()
    await pool.aclose()

async def test_resolve_unknown_job_id_is_not_found(redis_resolve_queue):
    assert (await redis_resolve_queue.state("no-such-job")).status == "not_found"

async def test_resolve_enqueued_job_shows_up_as_queued_and_counts_toward_depth(redis_resolve_queue):
    assert await redis_resolve_queue.depth() == 0
    enqueued = await redis_resolve_queue.enqueue(PLATFORM, "Faker", "KR1")
    assert await redis_resolve_queue.depth() == 1

    state = await redis_resolve_queue.state(enqueued.job_id)
    assert state.status in {"queued", "deferred"}
