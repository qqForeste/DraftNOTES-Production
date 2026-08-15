import uuid

import structlog
from arq.connections import RedisSettings

from app.config import get_settings
from app.db import SessionLocal
from app.log_config import configure_logging
from app.models import AppUser
from app.riot.client import RiotClient
from app.riot.platforms import continent_for_platform
from app.services.lookup import sync_looked_up_summoner
from app.services.pinned import sync_pinned_user
from app.services.sync import sync_older_matches, sync_summoner
from app.services.sync_queue import (
    cooldown_key,
    lookup_cooldown_key,
    older_matches_cooldown_key,
    pinned_cooldown_key,
)

settings = get_settings()
configure_logging(settings)
logger = structlog.get_logger(__name__)

class UnknownUserError(RuntimeError):
    pass

async def run_sync(
    ctx: dict, user_id: str, platform: str, game_name: str, tag_line: str
) -> dict:
    db = SessionLocal()
    try:
        user = db.get(AppUser, uuid.UUID(user_id))
        if user is None:
            raise UnknownUserError(f"user {user_id} no longer exists")
        result = await sync_summoner(
            db, ctx["riot_client"], user, platform, game_name, tag_line
        )
        logger.info(
            "sync_done",
            user_id=user_id,
            platform=platform,
            matches_seen=result["matches_seen"],
            matches_new=result["matches_new"],
        )
        return {
            "matches_seen": result["matches_seen"],
            "matches_new": result["matches_new"],
        }
    except Exception:
        await ctx["redis"].delete(cooldown_key(uuid.UUID(user_id)))
        logger.exception("sync_failed", user_id=user_id, platform=platform)
        raise
    finally:
        db.close()

async def run_pinned_sync(
    ctx: dict, user_id: str, platform: str, game_name: str, tag_line: str
) -> dict:
    db = SessionLocal()
    try:
        pinned = await sync_pinned_user(
            db, ctx["riot_client"], uuid.UUID(user_id), platform, game_name, tag_line
        )
        logger.info("pinned_sync_done", user_id=user_id, platform=platform, pinned_id=pinned.id)
        return {"pinned_id": pinned.id}
    except Exception:
        await ctx["redis"].delete(
            pinned_cooldown_key(uuid.UUID(user_id), platform, game_name, tag_line)
        )
        logger.exception("pinned_sync_failed", user_id=user_id, platform=platform)
        raise
    finally:
        db.close()

async def run_lookup_sync(
    ctx: dict, user_id: str, platform: str, game_name: str, tag_line: str
) -> dict:
    db = SessionLocal()
    try:
        summoner = await sync_looked_up_summoner(
            db, ctx["riot_client"], platform, game_name, tag_line
        )
        logger.info("lookup_sync_done", user_id=user_id, platform=platform, puuid=summoner.puuid)
        return {"puuid": summoner.puuid}
    except Exception:
        await ctx["redis"].delete(
            lookup_cooldown_key(uuid.UUID(user_id), platform, game_name, tag_line)
        )
        logger.exception("lookup_sync_failed", user_id=user_id, platform=platform)
        raise
    finally:
        db.close()

async def run_lookup_resolve(ctx: dict, platform: str, game_name: str, tag_line: str) -> dict:
    region = continent_for_platform(platform)
    account = await ctx["riot_client"].get_account_by_riot_id(region, game_name, tag_line)
    return {"puuid": account["puuid"]}

async def run_older_matches_sync(ctx: dict, puuid: str, region: str) -> dict:
    db = SessionLocal()
    try:
        result = await sync_older_matches(
            db,
            ctx["riot_client"],
            region,
            puuid,
            settings.older_matches_batch_size,
            settings.legacy_scoreboard_widen_batch,
        )
        logger.info("older_matches_sync_done", puuid=puuid, **result)
        return result
    except Exception:
        await ctx["redis"].delete(older_matches_cooldown_key(puuid))
        logger.exception("older_matches_sync_failed", puuid=puuid)
        raise
    finally:
        db.close()

async def startup(ctx: dict) -> None:
    ctx["riot_client"] = RiotClient(settings)
    logger.info("worker_startup", queue=settings.sync_queue_name)

async def shutdown(ctx: dict) -> None:
    await ctx["riot_client"].aclose()

class WorkerSettings:
    functions = [
        run_sync,
        run_pinned_sync,
        run_lookup_sync,
        run_lookup_resolve,
        run_older_matches_sync,
    ]
    on_startup = startup
    on_shutdown = shutdown
    queue_name = settings.sync_queue_name
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = settings.sync_worker_concurrency
    poll_delay = settings.sync_poll_delay_seconds
    keep_result = 3600
    max_tries = 1
