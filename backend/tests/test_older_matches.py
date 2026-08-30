import glob
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import pytest
from arq import create_pool
from arq.connections import RedisSettings
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user, get_older_matches_queue
from app.main import app
from app.models import AppUser, Match, Participant, Summoner
from app.riot.platforms import continent_for_platform
from app.services.sync import sync_older_matches
from app.services.sync_queue import EnqueuedSync, OlderMatchesJobState, RedisOlderMatchesQueue

PLATFORM = "euw1"
REGION = continent_for_platform(PLATFORM)
PUUID = "puuid-older-test"
TEST_REDIS_URL = get_settings().redis_url.rsplit("/", 1)[0] + "/1"

def _fixture_match() -> dict:
    with open(sorted(glob.glob("fixtures/matches/*.json"))[0], encoding="utf-8") as fh:
        return json.load(fh)

@dataclass
class FakeOlderMatchesQueue:
    cooldown: int | None = None
    queue_depth: int = 0
    enqueued: list = None

    def __post_init__(self):
        self.enqueued = []

    async def claim_slot(self, puuid):
        return self.cooldown

    async def depth(self):
        return self.queue_depth

    async def enqueue(self, puuid, region):
        self.enqueued.append((puuid, region))
        return EnqueuedSync(job_id="job-1", queue_position=1)

    async def state(self, job_id):
        return OlderMatchesJobState(job_id=job_id, status="complete", matches_new=1, exhausted=False)

@pytest.fixture()
def queue():
    return FakeOlderMatchesQueue()

@pytest.fixture()
def client(engine, queue):
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_older_matches_queue] = lambda: queue
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture()
def signed_in(client):
    client.post("/api/auth/dev-login", json={"email": "loader@example.com"})
    return client

@pytest.fixture()
def seeded_summoner(db):
    db.add(Summoner(puuid=PUUID, game_name="Faker", tag_line="KR1", region=REGION, platform=PLATFORM))
    db.commit()

class FakeRiot:
    def __init__(self, match_json=None, match_ids=None):
        self.match_json = match_json
        self.match_ids = match_ids if match_ids is not None else []
        self.end_times_seen = []

    async def get_ranked_match_ids(self, region, puuid, count=20, end_time=None):
        self.end_times_seen.append(end_time)
        return self.match_ids

    async def get_match(self, region, match_id):
        return self.match_json

def test_enqueues_and_never_calls_riot(signed_in, queue, seeded_summoner):
    resp = signed_in.post(f"/api/matches/older?puuid={PUUID}")
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued" and body["job_id"]
    assert queue.enqueued == [(PUUID, REGION)]

def test_cooldown(signed_in, queue, seeded_summoner):
    queue.cooldown = 12
    resp = signed_in.post(f"/api/matches/older?puuid={PUUID}")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "12"

def test_full_queue_sheds_load(signed_in, queue, seeded_summoner):
    queue.queue_depth = 10_000
    resp = signed_in.post(f"/api/matches/older?puuid={PUUID}")
    assert resp.status_code == 503
    assert queue.enqueued == []

def test_summoner_without_a_platform_is_rejected(signed_in, queue, db):
    db.add(Summoner(puuid="no-platform", game_name="Nobody", tag_line="EUW", region="europe"))
    db.commit()
    resp = signed_in.post("/api/matches/older?puuid=no-platform")
    assert resp.status_code == 422
    assert queue.enqueued == []

def test_unknown_puuid_is_404(signed_in, queue):
    resp = signed_in.post("/api/matches/older?puuid=does-not-exist")
    assert resp.status_code == 404
    assert queue.enqueued == []

def test_demo_accounts_cannot_load_more(client, db, queue, seeded_summoner):
    demo = AppUser(provider="demo", oauth_sub=str(uuid.uuid4()), email=None)
    db.add(demo)
    db.commit()
    app.dependency_overrides[get_current_user] = lambda: demo

    resp = client.post(f"/api/matches/older?puuid={PUUID}")
    assert resp.status_code == 403
    assert queue.enqueued == []

def test_requires_sign_in(client, seeded_summoner):
    assert client.post(f"/api/matches/older?puuid={PUUID}").status_code == 401

def test_unknown_job_id_via_the_fake(signed_in):
    resp = signed_in.get("/api/matches/older/job-1")
    assert resp.status_code == 200
    assert resp.json()["status"] == "complete"

async def test_first_ever_call_has_no_end_time(db):
    riot = FakeRiot(match_ids=[])
    result = await sync_older_matches(db, riot, "asia", PUUID, batch_size=5, legacy_widen_batch=0)
    assert riot.end_times_seen == [None]
    assert result == {"matches_new": 0, "exhausted": True}

async def test_picks_up_from_the_oldest_stored_match(db):
    oldest = datetime(2024, 1, 1, tzinfo=timezone.utc)
    db.add(Summoner(puuid=PUUID, game_name="Faker", tag_line="KR1", region="asia", platform=PLATFORM))
    db.add(
        Match(match_id="EXISTING1", game_creation=oldest, game_duration=1800, queue_id=420, patch="14.1")
    )
    db.add(
        Match(
            match_id="EXISTING2",
            game_creation=oldest + timedelta(days=1),
            game_duration=1800,
            queue_id=420,
            patch="14.1",
        )
    )
    db.add(
        Participant(
            match_id="EXISTING1", puuid=PUUID, champion_id=1, win=True,
            kills=1, deaths=1, assists=1, cs=1, gold_earned=1,
        )
    )
    db.add(
        Participant(
            match_id="EXISTING2", puuid=PUUID, champion_id=1, win=True,
            kills=1, deaths=1, assists=1, cs=1, gold_earned=1,
        )
    )
    db.commit()

    riot = FakeRiot(match_ids=[])
    await sync_older_matches(db, riot, "asia", PUUID, batch_size=5, legacy_widen_batch=0)

    assert riot.end_times_seen == [int(oldest.timestamp())]

async def test_a_full_batch_is_not_exhausted(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][2]["puuid"]
    riot = FakeRiot(match_json=data, match_ids=[match_id])

    db.add(Summoner(puuid=puuid, game_name="Faker", tag_line="KR1", region="asia"))
    db.commit()

    result = await sync_older_matches(db, riot, "asia", puuid, batch_size=1, legacy_widen_batch=0)

    assert result == {"matches_new": 1, "exhausted": False}
    assert db.get(Match, match_id) is not None
    assert db.get(Participant, (match_id, puuid)) is not None

async def test_a_short_batch_is_exhausted(db):
    riot = FakeRiot(match_ids=[])
    result = await sync_older_matches(db, riot, "asia", PUUID, batch_size=5, legacy_widen_batch=0)
    assert result == {"matches_new": 0, "exhausted": True}

@pytest.fixture()
async def redis_queue():
    settings = get_settings()
    pool = await create_pool(RedisSettings.from_dsn(TEST_REDIS_URL))
    await pool.flushdb()
    yield RedisOlderMatchesQueue(pool, "older:test", settings.older_matches_cooldown_seconds)
    await pool.flushdb()
    await pool.aclose()

async def test_unknown_job_id_is_not_found(redis_queue):
    assert (await redis_queue.state("no-such-job")).status == "not_found"

async def test_enqueued_job_shows_up_as_queued_and_counts_toward_depth(redis_queue):
    assert await redis_queue.depth() == 0
    enqueued = await redis_queue.enqueue(PUUID, "asia")
    assert await redis_queue.depth() == 1

    state = await redis_queue.state(enqueued.job_id)
    assert state.status in {"queued", "deferred"}

async def test_cooldown_allows_once_then_blocks(redis_queue):
    assert await redis_queue.claim_slot(PUUID) is None
    remaining = await redis_queue.claim_slot(PUUID)
    assert remaining is not None and remaining > 0

async def test_cooldown_is_per_target_not_per_caller(redis_queue):
    assert await redis_queue.claim_slot(PUUID) is None
    assert await redis_queue.claim_slot("some-other-puuid") is None

async def test_releasing_lets_it_retry(redis_queue):
    await redis_queue.claim_slot(PUUID)
    await redis_queue.release_slot(PUUID)
    assert await redis_queue.claim_slot(PUUID) is None
