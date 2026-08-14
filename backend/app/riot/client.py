import logging

import httpx

from app.config import Settings
from app.riot import fixtures
from app.riot.rate_limiter import RiotRateLimiter

logger = logging.getLogger(__name__)

REGIONAL_HOSTS = {
    "americas": "americas.api.riotgames.com",
    "europe": "europe.api.riotgames.com",
    "asia": "asia.api.riotgames.com",
    "sea": "sea.api.riotgames.com",
}

PLATFORM_HOSTS = {
    "na1": "na1.api.riotgames.com",
    "br1": "br1.api.riotgames.com",
    "la1": "la1.api.riotgames.com",
    "la2": "la2.api.riotgames.com",
    "oc1": "oc1.api.riotgames.com",
    "euw1": "euw1.api.riotgames.com",
    "eun1": "eun1.api.riotgames.com",
    "tr1": "tr1.api.riotgames.com",
    "ru": "ru.api.riotgames.com",
    "kr": "kr.api.riotgames.com",
    "jp1": "jp1.api.riotgames.com",
    "ph2": "ph2.api.riotgames.com",
    "sg2": "sg2.api.riotgames.com",
    "th2": "th2.api.riotgames.com",
    "tw2": "tw2.api.riotgames.com",
    "vn2": "vn2.api.riotgames.com",
}

MAX_RETRIES_ON_429 = 5

class RiotApiError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"Riot API error {status_code}: {message}")
        self.status_code = status_code

class RiotNotFoundError(RiotApiError):
    pass

class RiotAuthError(RiotApiError):
    pass

class RiotClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._settings = settings
        self._rate_limiter = RiotRateLimiter()
        self._http = httpx.AsyncClient(timeout=10.0, transport=transport)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "RiotClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    async def get_account_by_riot_id(self, region: str, game_name: str, tag_line: str) -> dict:
        host = _regional_host(region)
        fixture_path = f"account/{region}/{_slug(game_name)}-{_slug(tag_line)}.json"
        return await self._get(
            host=host,
            method="account-by-riot-id",
            path=f"/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}",
            fixture_path=fixture_path,
        )

    async def get_ranked_match_ids(
        self, region: str, puuid: str, count: int = 20, end_time: int | None = None
    ) -> list[str]:
        host = _regional_host(region)
        fixture_path = f"match_ids/{region}/{puuid}.json"
        params: dict = {"type": "ranked", "count": count}
        if end_time is not None:
            params["endTime"] = end_time
        result = await self._get(
            host=host,
            method="match-ids-by-puuid",
            path=f"/lol/match/v5/matches/by-puuid/{puuid}/ids",
            params=params,
            fixture_path=fixture_path,
            wrap_list_as="match_ids",
        )
        return result["match_ids"]

    async def get_match(self, region: str, match_id: str) -> dict:
        host = _regional_host(region)
        fixture_path = f"matches/{match_id}.json"
        return await self._get(
            host=host,
            method="match-by-id",
            path=f"/lol/match/v5/matches/{match_id}",
            fixture_path=fixture_path,
        )

    async def get_league_entries_by_puuid(self, platform: str, puuid: str) -> list[dict]:
        host = _platform_host(platform)
        fixture_path = f"league/{platform}/{puuid}.json"
        result = await self._get(
            host=host,
            method="league-entries-by-puuid",
            path=f"/lol/league/v4/entries/by-puuid/{puuid}",
            fixture_path=fixture_path,
            wrap_list_as="entries",
        )
        return result["entries"]

    async def _get(
        self,
        *,
        host: str,
        method: str,
        path: str,
        fixture_path: str,
        params: dict | None = None,
        wrap_list_as: str | None = None,
    ) -> dict:
        if self._settings.use_fixtures:
            data = fixtures.load(self._settings.fixtures_dir, fixture_path)
            return {wrap_list_as: data} if wrap_list_as else data

        if not self._settings.riot_api_key:
            raise RuntimeError(
                "RIOT_API_KEY is not set and USE_FIXTURES=false. Either set a key "
                "or set USE_FIXTURES=true to develop against saved fixtures."
            )

        data = await self._request_live(host=host, method=method, path=path, params=params)
        if self._settings.capture_fixtures:
            fixtures.save(self._settings.fixtures_dir, fixture_path, data)
        return {wrap_list_as: data} if wrap_list_as else data

    async def _request_live(self, *, host: str, method: str, path: str, params: dict | None) -> dict:
        url = f"https://{host}{path}"
        headers = {"X-Riot-Token": self._settings.riot_api_key}

        for attempt in range(1, MAX_RETRIES_ON_429 + 1):
            await self._rate_limiter.wait_for_slot(host, method)
            response = await self._http.get(url, params=params, headers=headers)
            self._rate_limiter.learn_from_headers(host, method, response.headers)

            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", "1"))
                rate_limit_type = response.headers.get("X-Rate-Limit-Type")
                logger.warning(
                    "429 from Riot API (%s, type=%s) on attempt %d/%d, backing off %.1fs",
                    method,
                    rate_limit_type,
                    attempt,
                    MAX_RETRIES_ON_429,
                    retry_after,
                )
                await self._rate_limiter.cool_down(host, method, rate_limit_type, retry_after)
                continue

            if response.status_code == 404:
                raise RiotNotFoundError(404, response.text)
            if response.status_code in (401, 403):
                raise RiotAuthError(response.status_code, response.text)
            if response.status_code >= 400:
                raise RiotApiError(response.status_code, response.text)

            return response.json()

        raise RiotApiError(429, f"Exceeded {MAX_RETRIES_ON_429} retries after repeated 429s")

def _regional_host(region: str) -> str:
    try:
        return REGIONAL_HOSTS[region]
    except KeyError:
        raise ValueError(f"Unknown region {region!r}, expected one of {sorted(REGIONAL_HOSTS)}") from None

def _platform_host(platform: str) -> str:
    try:
        return PLATFORM_HOSTS[platform]
    except KeyError:
        raise ValueError(f"Unknown platform {platform!r}, expected one of {sorted(PLATFORM_HOSTS)}") from None

def _slug(value: str) -> str:
    return value.strip().lower().replace(" ", "_")
