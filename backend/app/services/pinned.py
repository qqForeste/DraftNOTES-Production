
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Match, Participant, PinnedUser, Summoner
from app.riot.client import RiotClient
from app.riot.platforms import continent_for_platform
from app.schemas.pinned import PinnedUserMatch, PinnedUserOut
from app.services.aggregation import get_latest_profile_icon_id
from app.services.sync import apply_rank, record_rank_snapshots, sync_matches_for_puuid

log = structlog.get_logger(__name__)

async def sync_summoner_data(
    db: Session,
    riot_client: RiotClient,
    platform: str,
    game_name: str,
    tag_line: str,
    match_count: int,
) -> Summoner:
    region = continent_for_platform(platform)

    account = await riot_client.get_account_by_riot_id(region, game_name, tag_line)
    puuid = account["puuid"]

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
    summoner.platform = platform

    entries = await riot_client.get_league_entries_by_puuid(platform, puuid)
    apply_rank(summoner, "solo", next((e for e in entries if e["queueType"] == "RANKED_SOLO_5x5"), None))
    apply_rank(summoner, "flex", next((e for e in entries if e["queueType"] == "RANKED_FLEX_SR"), None))
    summoner.rank_checked_at = datetime.now(timezone.utc)
    record_rank_snapshots(db, summoner)
    db.commit()

    match_ids = await riot_client.get_ranked_match_ids(region, puuid, count=match_count)
    await sync_matches_for_puuid(
        db, riot_client, region, puuid, match_ids, get_settings().legacy_scoreboard_widen_batch
    )
    return summoner

async def sync_pinned_user(
    db: Session,
    riot_client: RiotClient,
    user_id: uuid.UUID,
    platform: str,
    game_name: str,
    tag_line: str,
) -> PinnedUser:
    settings = get_settings()
    summoner = await sync_summoner_data(
        db, riot_client, platform, game_name, tag_line, settings.pinned_recent_match_count
    )
    puuid = summoner.puuid

    pinned = db.execute(
        select(PinnedUser).where(PinnedUser.user_id == user_id, PinnedUser.puuid == puuid)
    ).scalar_one_or_none()
    if pinned is None:
        pinned = PinnedUser(user_id=user_id, puuid=puuid)
        db.add(pinned)
    pinned.synced_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pinned)
    return pinned

def list_pinned(db: Session, user_id: uuid.UUID) -> list[PinnedUser]:
    return list(
        db.execute(
            select(PinnedUser)
            .where(PinnedUser.user_id == user_id)
            .order_by(PinnedUser.created_at.desc(), PinnedUser.id.desc())
        )
        .scalars()
        .all()
    )

def get_pinned(db: Session, user_id: uuid.UUID, pinned_id: int) -> PinnedUser | None:
    return db.execute(
        select(PinnedUser).where(PinnedUser.id == pinned_id, PinnedUser.user_id == user_id)
    ).scalar_one_or_none()

def count_pinned(db: Session, user_id: uuid.UUID) -> int:
    return len(list(db.execute(select(PinnedUser.id).where(PinnedUser.user_id == user_id)).scalars()))

def to_out(db: Session, pinned: PinnedUser) -> PinnedUserOut:
    summoner = pinned.summoner
    rows = db.execute(
        select(Participant, Match)
        .join(Match, Match.match_id == Participant.match_id)
        .where(Participant.puuid == pinned.puuid)
        .order_by(Match.game_creation.desc())
        .limit(get_settings().pinned_recent_match_count)
    ).all()

    return PinnedUserOut(
        id=pinned.id,
        game_name=summoner.game_name,
        tag_line=summoner.tag_line,
        platform=summoner.platform or "",
        profile_icon_id=get_latest_profile_icon_id(db, pinned.puuid) or 0,
        tier=summoner.solo_tier,
        division=summoner.solo_division,
        lp=summoner.solo_lp,
        note=pinned.note,
        synced_at=pinned.synced_at or pinned.created_at,
        recent_matches=[
            PinnedUserMatch(
                match_id=participant.match_id,
                champion_id=participant.champion_id,
                win=participant.win,
                kills=participant.kills,
                deaths=participant.deaths,
                assists=participant.assists,
                queue_id=match.queue_id,
                game_creation=match.game_creation,
                game_duration=match.game_duration,
            )
            for participant, match in rows
        ],
    )
