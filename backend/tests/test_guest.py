import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.auth import GUEST_PROVIDER
from app.config import get_settings
from app.db import get_db
from app.dependencies import get_redis, get_sync_queue
from app.main import app
from app.models import AppUser
from app.services.guest import purge_expired_guest_users
from app.services.sync_queue import EnqueuedSync

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

def test_guest_login_gives_a_bare_account(client, db: Session):
    resp = client.post("/api/auth/guest-login")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["provider"] == GUEST_PROVIDER
    assert body["summoners"] == []

def test_guest_login_reuses_the_session(client, db: Session):
    first = client.post("/api/auth/guest-login").json()
    second = client.post("/api/auth/guest-login").json()
    assert first["id"] == second["id"]
    assert len(_guests(db)) == 1

def test_each_guest_visitor_gets_their_own_account(client, db: Session):
    client.post("/api/auth/guest-login")
    with TestClient(app) as other:
        other.post("/api/auth/guest-login")
    assert len(_guests(db)) == 2

def test_guest_can_sync_unlike_demo(client, db: Session):
    client.post("/api/auth/guest-login")
    fake_queue = _FakeSyncQueue()
    app.dependency_overrides[get_sync_queue] = lambda: fake_queue
    resp = client.post(
        "/api/summoners/sync",
        json={"game_name": "Someone", "tag_line": "EUW", "platform": "euw1"},
    )
    assert resp.status_code == 202, resp.text

def test_providers_reports_guest_enabled_by_default(client, db: Session):
    assert client.get("/api/auth/providers").json()["guest_enabled"] is True

def test_guest_login_404s_when_disabled(client, db: Session, monkeypatch):
    monkeypatch.setattr(get_settings(), "guest_mode_enabled", False)
    assert client.post("/api/auth/guest-login").status_code == 404
    assert client.get("/api/auth/providers").json()["guest_enabled"] is False

def test_guest_login_rate_limits_per_ip(client, db: Session):
    redis = _OneSlotRedis()
    app.dependency_overrides[get_redis] = lambda: redis
    assert client.post("/api/auth/guest-login").status_code == 200
    with TestClient(app) as other:
        resp = other.post("/api/auth/guest-login")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "30"

def test_guest_login_survives_redis_being_down(client, db: Session):
    broken = _BrokenRedis()
    app.dependency_overrides[get_redis] = lambda: broken
    assert client.post("/api/auth/guest-login").status_code == 200

def test_deleting_a_guest_account_works_like_any_other(client, db: Session):
    client.post("/api/auth/guest-login")
    assert client.delete("/api/auth/me").status_code == 204
    assert len(_guests(db)) == 0

def test_purge_removes_aged_guest_users(client, db: Session):
    user_id = uuid.UUID(client.post("/api/auth/guest-login").json()["id"])

    assert purge_expired_guest_users(db, ttl_days=7) == 0

    db.get(AppUser, user_id).created_at = datetime.now(timezone.utc) - timedelta(days=30)
    db.commit()

    assert purge_expired_guest_users(db, ttl_days=7) == 1
    assert db.get(AppUser, user_id) is None

def _guests(db: Session) -> list[AppUser]:
    return list(db.execute(select(AppUser).where(AppUser.provider == GUEST_PROVIDER)).scalars().all())

class _FakeSyncQueue:
    async def claim_slot(self, user_id):
        return None

    async def depth(self):
        return 0

    async def enqueue(self, user_id, platform, game_name, tag_line) -> EnqueuedSync:
        return EnqueuedSync(job_id="job-1", queue_position=1)

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
