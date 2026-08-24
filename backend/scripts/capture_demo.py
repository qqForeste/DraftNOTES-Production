
import argparse
import asyncio
import json
from datetime import datetime

from app.config import get_settings
from app.demo.seed import DATA_PATH
from app.models import Match, Participant, Summoner
from app.riot.client import RiotClient
from app.riot.platforms import continent_for_platform
from app.services.sync import _parse_match, apply_rank

DEFAULT_RIOT_ID = "Hide on bush#KR1"
DEFAULT_PLATFORM = "kr"

async def capture(riot_id: str, platform: str, anonymize: bool, with_ranks: bool) -> dict:
    game_name, tag_line = riot_id.split("#", 1)
    region = continent_for_platform(platform)
    settings = get_settings().model_copy(update={"capture_fixtures": False, "use_fixtures": False})

    async with RiotClient(settings) as client:
        account = await client.get_account_by_riot_id(region, game_name, tag_line)
        puuid = account["puuid"]

        entries = await client.get_league_entries_by_puuid(platform, puuid)
        summoner = Summoner(
            puuid=puuid,
            game_name=account["gameName"],
            tag_line=account["tagLine"],
            region=region,
            platform=platform,
        )
        apply_rank(summoner, "solo", _entry(entries, "RANKED_SOLO_5x5"))
        apply_rank(summoner, "flex", _entry(entries, "RANKED_FLEX_SR"))

        match_ids = await client.get_ranked_match_ids(region, puuid, count=20)
        captured = []
        rank_cache: dict[str, tuple[str | None, str | None]] = {}
        for match_id in match_ids:
            match_json = await client.get_match(region, match_id)
            match, participant = _parse_match(match_json, puuid)
            if with_ranks:
                await _fill_ranks(client, platform, match, rank_cache)
            if anonymize:
                _anonymize_scoreboard(match)
            captured.append(
                {"match": _row(match, Match), "participant": _row(participant, Participant)}
            )

    captured.sort(key=lambda e: e["match"]["game_creation"], reverse=True)
    return {
        "captured_at": datetime.now().astimezone().isoformat(),
        "riot_id": riot_id,
        "summoner": _row(summoner, Summoner, skip={"last_synced_at"}),
        "matches": captured,
    }

async def _fill_ranks(client, platform: str, match: Match, cache: dict) -> None:
    for row in match.scoreboard or []:
        puuid = row.get("puuid")
        if not puuid:
            continue
        if puuid not in cache:
            try:
                entries = await client.get_league_entries_by_puuid(platform, puuid)
                solo = _entry(entries, "RANKED_SOLO_5x5")
                cache[puuid] = (solo["tier"], solo["rank"]) if solo else (None, None)
            except Exception:
                cache[puuid] = (None, None)
        row["tier"], row["division"] = cache[puuid]

def _entry(entries: list[dict], queue_type: str) -> dict | None:
    return next((e for e in entries if e["queueType"] == queue_type), None)

def _anonymize_scoreboard(match: Match) -> None:
    for i, row in enumerate(match.scoreboard or [], start=1):
        if row["is_self"]:
            continue
        row["game_name"] = f"Player {i}"
        row["tag_line"] = "NA1"
        row["puuid"] = f"demo-anon-{match.match_id}-{i}"

def _row(obj, model, skip: set[str] | None = None) -> dict:
    skip = skip or set()
    out = {}
    for column in model.__table__.columns:
        if column.key in skip:
            continue
        value = getattr(obj, column.key)
        out[column.key] = value.isoformat() if isinstance(value, datetime) else value
    return out

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--riot-id", default=DEFAULT_RIOT_ID)
    parser.add_argument("--platform", default=DEFAULT_PLATFORM)
    parser.add_argument("--keep-names", action="store_true", help="don't anonymize the other nine")
    parser.add_argument(
        "--no-ranks", action="store_true", help="skip the per-player rank lookups (much faster)"
    )
    args = parser.parse_args()

    data = asyncio.run(
        capture(
            args.riot_id,
            args.platform,
            anonymize=not args.keep_names,
            with_ranks=not args.no_ranks,
        )
    )
    DATA_PATH.write_text(json.dumps(data, indent=1), encoding="utf-8")
    size_kb = DATA_PATH.stat().st_size / 1024
    print(
        f"Wrote {DATA_PATH} ({size_kb:.0f} KB): {args.riot_id} on {args.platform}, "
        f"{len(data['matches'])} matches. Commit it, then run `python -m app.demo.seed`."
    )

if __name__ == "__main__":
    main()
