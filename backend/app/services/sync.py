from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AppUser, Match, Participant, RankSnapshot, Summoner
from app.riot.client import RiotClient
from app.riot.platforms import continent_for_platform
from app.services.linking import link_summoner
from app.services.ranks import CallBudget, platform_from_match_id, resolve_ranks

log = structlog.get_logger(__name__)

QUEUES = ("solo", "flex")

async def sync_summoner(
    db: Session,
    riot_client: RiotClient,
    user: AppUser,
    platform: str,
    game_name: str,
    tag_line: str,
) -> dict:
    settings = get_settings()
    region = continent_for_platform(platform)
    account = await riot_client.get_account_by_riot_id(region, game_name, tag_line)
    puuid = account["puuid"]

    league_entries = await riot_client.get_league_entries_by_puuid(platform, puuid)
    solo_entry = next((e for e in league_entries if e["queueType"] == "RANKED_SOLO_5x5"), None)
    flex_entry = next((e for e in league_entries if e["queueType"] == "RANKED_FLEX_SR"), None)

    summoner = db.get(Summoner, puuid)
    if summoner is None:
        summoner = Summoner(
            puuid=puuid,
            game_name=account["gameName"],
            tag_line=account["tagLine"],
            region=region,
        )
        db.add(summoner)
    else:
        summoner.game_name = account["gameName"]
        summoner.tag_line = account["tagLine"]
        summoner.region = region
    summoner.platform = platform
    now = datetime.now(timezone.utc)
    summoner.last_synced_at = now
    summoner.rank_checked_at = now
    apply_rank(summoner, "solo", solo_entry)
    apply_rank(summoner, "flex", flex_entry)
    record_rank_snapshots(db, summoner)
    db.commit()

    link_summoner(db, user, puuid)

    match_ids = await riot_client.get_ranked_match_ids(
        region, puuid, count=settings.sync_match_count
    )
    matches_new = await sync_matches_for_puuid(
        db, riot_client, region, puuid, match_ids, settings.legacy_scoreboard_widen_batch
    )

    budget = CallBudget(settings.sync_rank_call_budget)
    for match_id in match_ids[: settings.scoreboard_rank_enrich_matches]:
        await _enrich_scoreboard_ranks(db, riot_client, match_id, settings, budget)

    return {
        "summoner": summoner,
        "matches_seen": len(match_ids),
        "matches_new": matches_new,
    }

async def sync_matches_for_puuid(
    db: Session,
    riot_client: RiotClient,
    region: str,
    puuid: str,
    match_ids: list[str],
    legacy_widen_batch: int,
) -> int:
    have_match_rows = {
        m.match_id: m
        for m in db.execute(select(Match).where(Match.match_id.in_(match_ids))).scalars()
    }
    have_match = set(have_match_rows)
    have_participant = set(
        db.execute(
            select(Participant.match_id).where(
                Participant.match_id.in_(match_ids), Participant.puuid == puuid
            )
        ).scalars()
    )
    todo = [m for m in match_ids if m not in have_participant]
    stale = list(
        db.execute(
            select(Match.match_id)
            .join(Participant, Participant.match_id == Match.match_id)
            .where(Participant.puuid == puuid, Match.winning_team_id.is_(None))
            .order_by(Match.game_creation.desc())
            .limit(legacy_widen_batch)
        ).scalars()
    )

    for match_id in todo:
        if match_id in have_match:
            match = have_match_rows[match_id]
            participant = _participant_from_scoreboard(match, puuid)
            if participant is not None:
                db.add(participant)
                db.commit()
                continue

        match_json = await riot_client.get_match(region, match_id)
        match, participant = _parse_match(match_json, puuid)
        if match_id in have_match:
            db.add(participant)
        else:
            db.add(match)
            db.add(participant)
        db.commit()

    for match_id in stale:
        match_json = await riot_client.get_match(region, match_id)
        fresh_match, fresh_participant = _parse_match(match_json, puuid)
        match = have_match_rows.get(match_id) or db.get(Match, match_id)
        match.scoreboard = fresh_match.scoreboard
        match.winning_team_id = fresh_match.winning_team_id
        db.merge(fresh_participant)
        db.commit()

    return len(todo)

async def sync_older_matches(
    db: Session,
    riot_client: RiotClient,
    region: str,
    puuid: str,
    batch_size: int,
    legacy_widen_batch: int,
) -> dict:
    oldest = db.execute(
        select(Match.game_creation)
        .join(Participant, Participant.match_id == Match.match_id)
        .where(Participant.puuid == puuid)
        .order_by(Match.game_creation.asc())
        .limit(1)
    ).scalar_one_or_none()
    end_time = int(oldest.timestamp()) if oldest is not None else None

    match_ids = await riot_client.get_ranked_match_ids(
        region, puuid, count=batch_size, end_time=end_time
    )
    matches_new = await sync_matches_for_puuid(
        db, riot_client, region, puuid, match_ids, legacy_widen_batch
    )
    return {"matches_new": matches_new, "exhausted": len(match_ids) < batch_size}

async def _enrich_scoreboard_ranks(
    db: Session,
    riot_client: RiotClient,
    match_id: str,
    settings,
    budget: CallBudget,
) -> None:
    match = db.get(Match, match_id)
    if match is None or not match.scoreboard:
        return
    stale = [e for e in match.scoreboard if e.get("puuid") and e.get("tier") is None]
    if not stale:
        return
    platform = platform_from_match_id(match_id)
    if platform is None:
        return

    ranks = await resolve_ranks(
        db, riot_client, stale, platform, settings.rank_cache_ttl_hours, budget
    )
    if not ranks:
        return

    scoreboard = [dict(entry) for entry in match.scoreboard]
    for entry in scoreboard:
        tier, division = ranks.get(entry.get("puuid"), (None, None))
        if tier is not None:
            entry["tier"] = tier
            entry["division"] = division
    match.scoreboard = scoreboard
    db.commit()

def apply_rank(summoner: Summoner, prefix: str, entry: dict | None) -> None:
    setattr(summoner, f"{prefix}_tier", entry["tier"] if entry else None)
    setattr(summoner, f"{prefix}_division", entry["rank"] if entry else None)
    setattr(summoner, f"{prefix}_lp", entry["leaguePoints"] if entry else None)
    setattr(summoner, f"{prefix}_wins", entry["wins"] if entry else None)
    setattr(summoner, f"{prefix}_losses", entry["losses"] if entry else None)

def record_rank_snapshots(db: Session, summoner: Summoner) -> None:
    db.flush()
    for queue in QUEUES:
        current = tuple(
            getattr(summoner, f"{queue}_{field}")
            for field in ("tier", "division", "lp", "wins", "losses")
        )
        if all(value is None for value in current):
            continue
        latest = db.execute(
            select(RankSnapshot)
            .where(RankSnapshot.puuid == summoner.puuid, RankSnapshot.queue == queue)
            .order_by(RankSnapshot.captured_at.desc(), RankSnapshot.id.desc())
            .limit(1)
        ).scalar_one_or_none()
        if latest is not None and (
            latest.tier,
            latest.division,
            latest.lp,
            latest.wins,
            latest.losses,
        ) == current:
            continue
        tier, division, lp, wins, losses = current
        db.add(
            RankSnapshot(
                puuid=summoner.puuid,
                queue=queue,
                tier=tier,
                division=division,
                lp=lp,
                wins=wins,
                losses=losses,
            )
        )

def _build_scoreboard(participants: list[dict], self_puuid: str) -> list[dict]:
    entries = []
    for pp in participants:
        keystone_id, secondary_style_id = _rune_ids(pp.get("perks", {}))
        entries.append(
            {
                "puuid": pp["puuid"],
                "game_name": pp.get("riotIdGameName") or pp.get("summonerName") or "Unknown",
                "tag_line": pp.get("riotIdTagline") or "",
                "tier": None,
                "division": None,
                "champion_id": pp["championId"],
                "team_id": pp["teamId"],
                "is_self": pp["puuid"] == self_puuid,
                "team_position": pp.get("teamPosition") or None,
                "champion_level": pp.get("champLevel", 0),
                "kills": pp["kills"],
                "deaths": pp["deaths"],
                "assists": pp["assists"],
                "cs": pp["totalMinionsKilled"] + pp["neutralMinionsKilled"],
                "gold_earned": pp["goldEarned"],
                "damage_dealt": pp.get("totalDamageDealtToChampions", 0),
                "items": [pp[f"item{i}"] for i in range(7)],
                "role_quest_item_id": pp.get("roleBoundItem"),
                "summoner_1_id": pp["summoner1Id"],
                "summoner_2_id": pp["summoner2Id"],
                "primary_rune_id": keystone_id,
                "secondary_style_id": secondary_style_id,
            }
        )
    return entries

def _participant_from_scoreboard(match: Match, puuid: str) -> Participant | None:
    if not match.scoreboard or match.winning_team_id is None:
        return None
    entry = next((e for e in match.scoreboard if e.get("puuid") == puuid), None)
    if entry is None or "kills" not in entry:
        return None

    team_kills = sum(e["kills"] for e in match.scoreboard if e.get("team_id") == entry["team_id"])
    kill_participation = (
        round(100 * (entry["kills"] + entry["assists"]) / team_kills, 1) if team_kills else None
    )
    return Participant(
        match_id=match.match_id,
        puuid=puuid,
        champion_id=entry["champion_id"],
        team_position=entry.get("team_position"),
        win=entry["team_id"] == match.winning_team_id,
        kills=entry["kills"],
        deaths=entry["deaths"],
        assists=entry["assists"],
        cs=entry["cs"],
        gold_earned=entry["gold_earned"],
        items=entry.get("items"),
        summoner_1_id=entry.get("summoner_1_id"),
        summoner_2_id=entry.get("summoner_2_id"),
        primary_rune_id=entry.get("primary_rune_id"),
        secondary_style_id=entry.get("secondary_style_id"),
        champion_level=entry.get("champion_level"),
        role_quest_item_id=entry.get("role_quest_item_id"),
        kill_participation_pct=kill_participation,
    )

def _rune_ids(perks: dict) -> tuple[int | None, int | None]:
    styles = perks.get("styles", [])
    primary = next((s for s in styles if s.get("description") == "primaryStyle"), None)
    sub = next((s for s in styles if s.get("description") == "subStyle"), None)
    keystone = primary["selections"][0]["perk"] if primary and primary.get("selections") else None
    secondary_style = sub["style"] if sub else None
    return keystone, secondary_style

def _kill_participation_pct(p: dict, all_participants: list[dict]) -> float | None:
    team_kills = sum(pp["kills"] for pp in all_participants if pp["teamId"] == p["teamId"])
    if team_kills == 0:
        return None
    return round(100 * (p["kills"] + p["assists"]) / team_kills, 1)

def _winning_team_id(info: dict) -> int | None:
    return next((t["teamId"] for t in info.get("teams", []) if t.get("win")), None)

def _parse_match(match_json: dict, puuid: str) -> tuple[Match, Participant]:
    info = match_json["info"]
    match_id = match_json["metadata"]["matchId"]

    version_parts = info["gameVersion"].split(".")
    patch = f"{version_parts[0]}.{version_parts[1]}"

    p = next(p for p in info["participants"] if p["puuid"] == puuid)
    keystone_id, secondary_style_id = _rune_ids(p.get("perks", {}))

    match = Match(
        match_id=match_id,
        game_creation=datetime.fromtimestamp(info["gameCreation"] / 1000, tz=timezone.utc),
        game_duration=info["gameDuration"],
        queue_id=info["queueId"],
        patch=patch,
        scoreboard=_build_scoreboard(info["participants"], puuid),
        winning_team_id=_winning_team_id(info),
    )

    participant = Participant(
        match_id=match_id,
        puuid=puuid,
        champion_id=p["championId"],
        team_position=p.get("teamPosition") or None,
        win=p["win"],
        kills=p["kills"],
        deaths=p["deaths"],
        assists=p["assists"],
        cs=p["totalMinionsKilled"] + p["neutralMinionsKilled"],
        gold_earned=p["goldEarned"],
        items=[p[f"item{i}"] for i in range(7)],
        summoner_1_id=p["summoner1Id"],
        summoner_2_id=p["summoner2Id"],
        primary_rune_id=keystone_id,
        secondary_style_id=secondary_style_id,
        champion_level=p["champLevel"],
        double_kills=p["doubleKills"],
        triple_kills=p["tripleKills"],
        quadra_kills=p["quadraKills"],
        penta_kills=p["pentaKills"],
        wards_placed=p["wardsPlaced"],
        control_wards_purchased=p["visionWardsBoughtInGame"],
        kill_participation_pct=_kill_participation_pct(p, info["participants"]),
        profile_icon_id=p["profileIcon"],
        role_quest_item_id=p.get("roleBoundItem"),
    )
    return match, participant
