import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.main import app
from app.tags import MISTAKE_TAG_LABELS, RETIRED_TAG_REMAP, GamePhase, MistakeTag

@pytest.fixture()
def client(engine, db):
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

def test_every_tag_has_a_label():
    assert set(MISTAKE_TAG_LABELS) == set(MistakeTag)

def test_retired_tags_map_onto_live_ones():
    live = {t.value for t in MistakeTag}
    assert not (set(RETIRED_TAG_REMAP) & live), "a retired key is still a live tag"
    assert set(RETIRED_TAG_REMAP.values()) <= live

def test_taxonomy_endpoints(client):
    tags = client.get("/api/tags").json()
    assert [t["tag_key"] for t in tags] == [t.value for t in MistakeTag]
    assert all(t["label"] for t in tags)
    assert client.get("/api/tags/phases").json() == [p.value for p in GamePhase]
