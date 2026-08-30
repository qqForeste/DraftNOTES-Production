import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.main import app
from app.matchup_tags import (
    PLAYSTYLE_TAG_LABELS,
    WEAKNESS_TAG_LABELS,
    MatchupPlaystyleTag,
    MatchupWeaknessTag,
)

EMAIL = "matchups@example.com"

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

@pytest.fixture()
def signed_in(client):
    client.post("/api/auth/dev-login", json={"email": EMAIL})
    return client

def payload(**over):
    body = {
        "role": "MIDDLE",
        "your_champion_id": 103,
        "enemy_champion_id": 157,
        "tags": ["lane_bully", "scales_late"],
        "weaknesses": ["vulnerable_to_ganks"],
        "body": "Respect the level 3 all in.",
    }
    body.update(over)
    return body

def test_taxonomies_match_the_frontend(client):
    tags = client.get("/api/matchups/tags").json()
    assert [t["tag_key"] for t in tags] == [t.value for t in MatchupPlaystyleTag]
    assert {t["tag_key"]: t["label"] for t in tags} == {
        k.value: v for k, v in PLAYSTYLE_TAG_LABELS.items()
    }
    assert dict(list({t["tag_key"]: t["label"] for t in tags}.items())[:2]) == {
        "lane_bully": "Lane bully",
        "wins_level_1": "Wins Lvl 1",
    }

    weak = client.get("/api/matchups/weaknesses").json()
    assert [w["tag_key"] for w in weak] == [w.value for w in MatchupWeaknessTag]
    assert {w["tag_key"]: w["label"] for w in weak} == {
        k.value: v for k, v in WEAKNESS_TAG_LABELS.items()
    }
    assert {w["tag_key"]: w["label"] for w in weak}["mana_issues"] == "Mana Issues"

def test_taxonomy_routes_are_not_read_as_ids(signed_in):
    assert signed_in.get("/api/matchups/tags").status_code == 200
    assert signed_in.get("/api/matchups/weaknesses").status_code == 200

def test_requires_sign_in(client):
    assert client.get("/api/matchups").status_code == 401
    assert client.post("/api/matchups", json=payload()).status_code == 401

def test_works_without_a_linked_riot_id(signed_in):
    assert signed_in.get("/api/matchups").json() == []
    assert signed_in.post("/api/matchups", json=payload()).status_code == 201

def test_create_pads_the_loadout(signed_in):
    out = signed_in.post("/api/matchups", json=payload()).json()
    assert out["core_item_ids"] == [None, None, None]
    assert out["optional_item_ids"] == [None, None, None]
    assert len(out["skill_order"]) == 18
    assert out["runes"]["primary_rune_ids"] == [None] * 4
    assert out["runes"]["stat_shard_ids"] == [None] * 3
    assert out["tags"] == ["lane_bully", "scales_late"]

def test_update_replaces_tags_and_keeps_omitted_loadout(signed_in):
    created = signed_in.post(
        "/api/matchups", json=payload(boot_item_id=3020, skill_order=["Q", "W", "E"])
    ).json()

    updated = signed_in.put(
        f"/api/matchups/{created['id']}", json=payload(tags=["poke_matchup"])
    ).json()
    assert updated["tags"] == ["poke_matchup"]
    assert updated["boot_item_id"] == 3020, "omitted slot keeps its value"
    assert updated["skill_order"][:3] == ["Q", "W", "E"]

    cleared = signed_in.put(
        f"/api/matchups/{created['id']}", json=payload(boot_item_id=None)
    ).json()
    assert cleared["boot_item_id"] is None, "explicit null clears the slot"

def test_creating_the_same_pairing_twice_updates_it(signed_in):
    first = signed_in.post("/api/matchups", json=payload()).json()
    second = signed_in.post("/api/matchups", json=payload(body="rewritten")).json()
    assert second["id"] == first["id"]
    assert second["body"] == "rewritten"
    assert len(signed_in.get("/api/matchups").json()) == 1

def test_moving_a_matchup_onto_an_occupied_pairing_conflicts(signed_in):
    signed_in.post("/api/matchups", json=payload())
    other = signed_in.post(
        "/api/matchups", json=payload(enemy_champion_id=238)
    ).json()
    resp = signed_in.put(f"/api/matchups/{other['id']}", json=payload())
    assert resp.status_code == 409

def test_delete(signed_in):
    created = signed_in.post("/api/matchups", json=payload()).json()
    assert signed_in.delete(f"/api/matchups/{created['id']}").status_code == 204
    assert signed_in.get("/api/matchups").json() == []
    assert signed_in.delete(f"/api/matchups/{created['id']}").status_code == 404

def test_another_users_matchup_is_not_found(client, signed_in):
    mine = signed_in.post("/api/matchups", json=payload()).json()
    client.post("/api/auth/logout")
    client.post("/api/auth/dev-login", json={"email": "someone-else@example.com"})
    assert client.get("/api/matchups").json() == []
    assert client.put(f"/api/matchups/{mine['id']}", json=payload()).status_code == 404
    assert client.delete(f"/api/matchups/{mine['id']}").status_code == 404

def test_rejects_bad_input(signed_in):
    assert signed_in.post("/api/matchups", json=payload(role="SUPPORT")).status_code == 422
    assert signed_in.post("/api/matchups", json=payload(tags=["nope"])).status_code == 422
    assert (
        signed_in.post("/api/matchups", json=payload(tags=["lane_bully", "lane_bully"])).status_code
        == 422
    )
