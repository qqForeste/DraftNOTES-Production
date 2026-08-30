import uuid

import pytest
from arq import create_pool
from arq.connections import RedisSettings
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_sync_queue
from app.main import app
from app.services.sync_queue import EnqueuedSync, RedisSyncQueue, SyncJobState

EMAIL = "queue@example.com"
TEST_REDIS_URL = get_settings().redis_url.rsplit("/", 1)[0] + "/1"

class FakeSyncQueue:

    def __init__(self) -> None:
        self.cooldowns: set[uuid.UUID] = set()
        self.queue_depth = 0
        self.enqueued: list[tuple] = []
        self.states: dict[str, SyncJobState] = {}

    async def claim_slot(self, user_id: uuid.UUID) -> int | None:
        if user_id in self.cooldowns:
            return 42
        self.cooldowns.add(user_id)
        return None

    async def depth(self) -> int:
        return self.queue_depth

    async def enqueue(self, user_id, platform, game_name, tag_line) -> EnqueuedSync:
        self.enqueued.append((user_id, platform, game_name, tag_line))
        return EnqueuedSync(job_id="job-1", queue_position=self.queue_depth + 1)

    async def state(self, job_id: str) -> SyncJobState:
        return self.states.get(job_id, SyncJobState(job_id=job_id, status="not_found"))

@pytest.fixture()
def fake_queue():
    return FakeSyncQueue()

@pytest.fixture()
def client(engine, fake_queue):
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_queue] = lambda: fake_queue
    with TestClient(app) as c:
        c.post("/api/auth/dev-login", json={"email": EMAIL}).raise_for_status()
        yield c
    app.dependency_overrides.clear()

SYNC_BODY = {"game_name": "RogueCritter", "tag_line": "EUW", "platform": "euw1"}

def test_sync_returns_202_and_does_not_call_riot(client, fake_queue):
    resp = client.post("/api/summoners/sync", json=SYNC_BODY)
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued"
    assert body["job_id"] == "job-1"
    assert len(fake_queue.enqueued) == 1
    assert fake_queue.enqueued[0][1:] == ("euw1", "RogueCritter", "EUW")

def test_second_sync_is_rate_limited_with_retry_after(client):
    client.post("/api/summoners/sync", json=SYNC_BODY).raise_for_status()
    resp = client.post("/api/summoners/sync", json=SYNC_BODY)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "42"

def test_full_queue_sheds_load_instead_of_growing(client, fake_queue):
    fake_queue.queue_depth = get_settings().sync_max_queue_depth
    resp = client.post("/api/summoners/sync", json=SYNC_BODY)
    assert resp.status_code == 503
    assert fake_queue.enqueued == []

def test_full_queue_does_not_burn_the_users_cooldown(client, fake_queue):
    fake_queue.queue_depth = get_settings().sync_max_queue_depth
    client.post("/api/summoners/sync", json=SYNC_BODY)
    fake_queue.queue_depth = 0
    assert client.post("/api/summoners/sync", json=SYNC_BODY).status_code == 202

def test_sync_needs_a_session(engine, fake_queue):
    TestSession = sessionmaker(bind=engine)
    app.dependency_overrides[get_db] = lambda: iter([TestSession()])
    app.dependency_overrides[get_sync_queue] = lambda: fake_queue
    with TestClient(app) as anon:
        assert anon.post("/api/summoners/sync", json=SYNC_BODY).status_code == 401
    app.dependency_overrides.clear()

def test_unknown_platform_is_rejected_before_queueing(client, fake_queue):
    resp = client.post("/api/summoners/sync", json={**SYNC_BODY, "platform": "mars1"})
    assert resp.status_code == 422
    assert fake_queue.enqueued == []

def test_unknown_job_is_404(client):
    assert client.get("/api/summoners/sync/nope").status_code == 404

def test_completed_job_reports_counts(client, fake_queue):
    fake_queue.states["job-1"] = SyncJobState(
        job_id="job-1", status="complete", matches_seen=20, matches_new=3
    )
    body = client.get("/api/summoners/sync/job-1").json()
    assert body["status"] == "complete"
    assert body["matches_new"] == 3

def test_failed_job_surfaces_the_error(client, fake_queue):
    fake_queue.states["job-1"] = SyncJobState(
        job_id="job-1", status="failed", error="RiotAuthError"
    )
    body = client.get("/api/summoners/sync/job-1").json()
    assert body["status"] == "failed"
    assert "RiotAuthError" in body["error"]

@pytest.fixture()
async def redis_queue():
    settings = get_settings()
    pool = await create_pool(RedisSettings.from_dsn(TEST_REDIS_URL))
    await pool.flushdb()
    yield RedisSyncQueue(pool, "sync:test", settings.sync_cooldown_seconds)
    await pool.flushdb()
    await pool.aclose()

async def test_cooldown_allows_once_then_blocks(redis_queue):
    user_id = uuid.uuid4()
    assert await redis_queue.claim_slot(user_id) is None
    remaining = await redis_queue.claim_slot(user_id)
    assert remaining is not None and remaining > 0

async def test_cooldown_is_per_user(redis_queue):
    assert await redis_queue.claim_slot(uuid.uuid4()) is None
    assert await redis_queue.claim_slot(uuid.uuid4()) is None

async def test_releasing_lets_the_user_retry(redis_queue):
    user_id = uuid.uuid4()
    await redis_queue.claim_slot(user_id)
    await redis_queue.release_slot(user_id)
    assert await redis_queue.claim_slot(user_id) is None

async def test_enqueued_job_shows_up_as_queued_and_counts_toward_depth(redis_queue):
    assert await redis_queue.depth() == 0
    enqueued = await redis_queue.enqueue(uuid.uuid4(), "euw1", "RogueCritter", "EUW")
    assert await redis_queue.depth() == 1

    state = await redis_queue.state(enqueued.job_id)
    assert state.status in {"queued", "deferred"}

async def test_unknown_job_id_is_not_found(redis_queue):
    assert (await redis_queue.state("no-such-job")).status == "not_found"
