
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Summoner
from app.riot.client import RiotApiError, RiotClient
from app.riot.platforms import PLATFORM_TO_CONTINENT, continent_for_platform

log = structlog.get_logger(__name__)

Rank = tuple[str | None, str | None]
UNRANKED: Rank = (None, None)

@dataclass
class CallBudget:

    remaining: int

    def take(self) -> bool:
        if self.remaining <= 0:
            return False
        self.remaining -= 1
        return True

def platform_from_match_id(match_id: str) -> str | None:
    prefix, _, rest = match_id.partition("_")
    if not rest:
        return None
    platform = prefix.lower()
    return platform if platform in PLATFORM_TO_CONTINENT else None

def _is_fresh(summoner: Summoner, ttl_hours: int) -> bool:
    if summoner.rank_checked_at is None:
        return False
    checked = summoner.rank_checked_at
    if checked.tzinfo is None:
        checked = checked.replace(tzinfo=timezone.utc)
    return checked > datetime.now(timezone.utc) - timedelta(hours=ttl_hours)

def _rank_of(summoner: Summoner) -> Rank:
    return (summoner.solo_tier, summoner.solo_division)

async def resolve_ranks(
    db: Session,
    riot_client: RiotClient,
    entries: list[dict],
    platform: str,
    ttl_hours: int,
    budget: CallBudget,
) -> dict[str, Rank]:
    from app.services.sync import apply_rank, record_rank_snapshots

    wanted = {e["puuid"]: e for e in entries if e.get("puuid")}
    if not wanted:
        return {}

    rows = {
        s.puuid: s
        for s in db.execute(select(Summoner).where(Summoner.puuid.in_(wanted))).scalars()
    }

    ranks: dict[str, Rank] = {}
    for puuid, entry in wanted.items():
        summoner = rows.get(puuid)
        if summoner is not None and _is_fresh(summoner, ttl_hours):
            ranks[puuid] = _rank_of(summoner)
            continue

        if not budget.take():
            ranks[puuid] = _rank_of(summoner) if summoner else UNRANKED
            continue

        try:
            league_entries = await riot_client.get_league_entries_by_puuid(platform, puuid)
        except RiotApiError as exc:
            log.warning("rank_lookup_failed", puuid=puuid, platform=platform, error=str(exc))
            ranks[puuid] = _rank_of(summoner) if summoner else UNRANKED
            continue

        if summoner is None:
            summoner = Summoner(
                puuid=puuid,
                game_name=entry.get("game_name") or "Unknown",
                tag_line=entry.get("tag_line") or "",
                region=continent_for_platform(platform),
                platform=platform,
            )
            db.add(summoner)

        solo = next((e for e in league_entries if e["queueType"] == "RANKED_SOLO_5x5"), None)
        flex = next((e for e in league_entries if e["queueType"] == "RANKED_FLEX_SR"), None)
        apply_rank(summoner, "solo", solo)
        apply_rank(summoner, "flex", flex)
        summoner.rank_checked_at = datetime.now(timezone.utc)
        record_rank_snapshots(db, summoner)
        ranks[puuid] = _rank_of(summoner)

    db.commit()
    return ranks
