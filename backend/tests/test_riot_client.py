import json

import httpx
import pytest

from app.config import Settings
from app.riot.client import RiotAuthError, RiotClient, RiotNotFoundError

def _settings(tmp_path, **overrides) -> Settings:
    defaults = dict(
        database_url="sqlite://unused",
        riot_api_key="dev-key",
        use_fixtures=False,
        fixtures_dir=tmp_path,
    )
    defaults.update(overrides)
    return Settings(**defaults)

async def test_retries_after_429_then_succeeds(tmp_path):
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(
                429,
                headers={"Retry-After": "0.2", "X-Rate-Limit-Type": "method"},
                text="rate limited",
            )
        return httpx.Response(
            200,
            headers={"X-App-Rate-Limit": "20:1,100:120", "X-Method-Rate-Limit": "20:1"},
            json={"puuid": "abc", "gameName": "Faker", "tagLine": "KR1"},
        )

    client = RiotClient(_settings(tmp_path), transport=httpx.MockTransport(handler))
    try:
        account = await client.get_account_by_riot_id("americas", "Faker", "KR1")
    finally:
        await client.aclose()

    assert calls["n"] == 2
    assert account["puuid"] == "abc"

async def test_404_raises_not_found(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"status": {"message": "Data not found"}})

    client = RiotClient(_settings(tmp_path), transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(RiotNotFoundError):
            await client.get_account_by_riot_id("americas", "Nobody", "0000")
    finally:
        await client.aclose()

async def test_expired_dev_key_raises_auth_error(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"status": {"message": "Unauthorized"}})

    client = RiotClient(_settings(tmp_path), transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(RiotAuthError):
            await client.get_match("americas", "NA1_1")
    finally:
        await client.aclose()

async def test_successful_response_is_written_as_a_fixture(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"metadata": {"matchId": "NA1_1"}, "info": {}})

    client = RiotClient(_settings(tmp_path), transport=httpx.MockTransport(handler))
    try:
        await client.get_match("americas", "NA1_1")
    finally:
        await client.aclose()

    saved = json.loads((tmp_path / "matches" / "NA1_1.json").read_text())
    assert saved["metadata"]["matchId"] == "NA1_1"

async def test_use_fixtures_serves_saved_response_without_network_call(tmp_path):
    fixture_dir = tmp_path / "matches"
    fixture_dir.mkdir()
    (fixture_dir / "NA1_1.json").write_text(json.dumps({"metadata": {"matchId": "NA1_1"}}))

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not hit the network when USE_FIXTURES=true")

    client = RiotClient(
        _settings(tmp_path, use_fixtures=True), transport=httpx.MockTransport(handler)
    )
    try:
        match = await client.get_match("americas", "NA1_1")
    finally:
        await client.aclose()

    assert match["metadata"]["matchId"] == "NA1_1"

async def test_league_entries_by_puuid_hits_platform_host(tmp_path):
    seen_urls = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        return httpx.Response(200, json=[{"queueType": "RANKED_SOLO_5x5", "tier": "GOLD"}])

    client = RiotClient(_settings(tmp_path), transport=httpx.MockTransport(handler))
    try:
        entries = await client.get_league_entries_by_puuid("euw1", "puuid-1")
    finally:
        await client.aclose()

    assert entries[0]["tier"] == "GOLD"
    assert seen_urls[0].startswith("https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/")

async def test_unknown_platform_raises_value_error(tmp_path):
    client = RiotClient(_settings(tmp_path))
    try:
        with pytest.raises(ValueError):
            await client.get_league_entries_by_puuid("not-a-real-platform", "puuid-1")
    finally:
        await client.aclose()
