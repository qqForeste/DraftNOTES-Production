from contextlib import asynccontextmanager

import structlog
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.auth import build_oauth
from app.config import get_settings
from app.db import engine
from app.log_config import configure_logging
from app.middleware import RequestContextMiddleware
from app.routers import auth, lookup, matches, matchups, notes, pinned, stats, summoners, tags
from app.services.sync_queue import (
    RedisLookupQueue,
    RedisOlderMatchesQueue,
    RedisPinnedQueue,
    RedisResolveQueue,
    RedisSyncQueue,
)

settings = get_settings()
configure_logging(settings)
logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    app.state.redis = pool
    app.state.sync_queue = RedisSyncQueue(
        pool, settings.sync_queue_name, settings.sync_cooldown_seconds
    )
    app.state.pinned_queue = RedisPinnedQueue(
        pool, settings.sync_queue_name, settings.pinned_refresh_cooldown_seconds
    )
    app.state.lookup_queue = RedisLookupQueue(
        pool, settings.sync_queue_name, settings.lookup_cooldown_seconds
    )
    app.state.resolve_queue = RedisResolveQueue(pool, settings.sync_queue_name)
    app.state.older_matches_queue = RedisOlderMatchesQueue(
        pool, settings.sync_queue_name, settings.older_matches_cooldown_seconds
    )
    app.state.oauth = build_oauth(settings)
    logger.info(
        "startup",
        env=settings.env,
        cors_origins=settings.cors_origin_list,
        oauth_providers=settings.enabled_oauth_providers,
        dev_login_enabled=settings.dev_login_enabled,
        sync_queue=settings.sync_queue_name,
    )
    yield
    await pool.aclose()

app = FastAPI(title="DraftNotes API", lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="draftnotes_session",
    max_age=settings.session_max_age_seconds,
    same_site="lax",
    https_only=bool(settings.session_cookie_secure),
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(summoners.router)
app.include_router(matches.router)
app.include_router(notes.router)
app.include_router(stats.router)
app.include_router(tags.router)
app.include_router(matchups.router)
app.include_router(pinned.router)
app.include_router(lookup.router)

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}

@app.get("/api/health/ready")
async def ready(request: Request, response: Response) -> dict:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("readiness_check_failed", error=str(exc))
        response.status_code = 503
        return {"status": "unavailable", "database": "unreachable", "redis": "unknown"}

    try:
        await request.app.state.redis.ping()
    except Exception as exc:
        logger.warning("redis_unreachable", error=str(exc))
        return {"status": "degraded", "database": "ok", "redis": "unreachable"}
    return {"status": "ok", "database": "ok", "redis": "ok"}
