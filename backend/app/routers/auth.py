import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import (
    DEMO_PROVIDER,
    DEV_PROVIDER,
    GUEST_PROVIDER,
    clear_session,
    establish_session,
    get_or_create_user,
    profile_from_discord,
    profile_from_google,
    session_user_id,
)
from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user, get_redis
from app.models import AppUser, Summoner, UserSummoner
from app.schemas.auth import AuthProviders, DevLoginRequest, LinkedSummoner, MeOut
from app.services.account import delete_account
from app.services.demo import (
    clone_template_matchups,
    clone_template_notes,
    create_demo_user,
    demo_summoner_puuid,
    find_demo_template,
)
from app.services.guest import create_guest_user

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

PROFILE_READERS = {"google": profile_from_google, "discord": profile_from_discord}

@router.get("/providers", response_model=AuthProviders)
def providers(db: Session = Depends(get_db)) -> AuthProviders:
    settings = get_settings()
    demo_enabled = settings.demo_mode_enabled and demo_summoner_puuid(db) is not None
    return AuthProviders(
        providers=settings.enabled_oauth_providers,
        dev_login_enabled=bool(settings.dev_login_enabled),
        demo_enabled=demo_enabled,
        guest_enabled=settings.guest_mode_enabled,
    )

@router.get("/{provider}/login")
async def login(provider: str, request: Request) -> RedirectResponse:
    client = _client_or_404(request, provider)
    return await client.authorize_redirect(request, _redirect_uri(request, provider))

def _redirect_uri(request: Request, provider: str) -> str:
    base = get_settings().oauth_redirect_base_url
    if base:
        return f"{base.rstrip('/')}/api/auth/{provider}/callback"
    return str(request.url_for("callback", provider=provider))

@router.get("/{provider}/callback", name="callback")
async def callback(provider: str, request: Request, db: Session = Depends(get_db)):
    client = _client_or_404(request, provider)
    settings = get_settings()
    try:
        token = await client.authorize_access_token(request)
        oauth_sub, email, display_name = await PROFILE_READERS[provider](token, client)
    except Exception as exc:
        logger.warning("oauth_callback_failed", provider=provider, error=str(exc))
        return RedirectResponse(f"{settings.frontend_url}/?auth_error=1")

    user = get_or_create_user(db, provider, oauth_sub, email, display_name)
    establish_session(request, user)
    logger.info("login", provider=provider, user_id=str(user.id))
    return RedirectResponse(settings.frontend_url)

@router.post("/dev-login", response_model=MeOut)
def dev_login(
    payload: DevLoginRequest, request: Request, db: Session = Depends(get_db)
) -> MeOut:
    settings = get_settings()
    if not settings.dev_login_enabled:
        raise HTTPException(status_code=404, detail="Not found")
    user = get_or_create_user(
        db, DEV_PROVIDER, payload.email, payload.email, payload.email.split("@")[0]
    )
    establish_session(request, user)
    return _me(db, user)

@router.post("/demo-login", response_model=MeOut)
async def demo_login(
    request: Request, db: Session = Depends(get_db), redis=Depends(get_redis)
) -> MeOut:
    settings = get_settings()
    if not settings.demo_mode_enabled:
        raise HTTPException(status_code=404, detail="Not found")

    existing = _current_demo_user(request, db)
    if existing is not None:
        return _me(db, existing)

    retry_after = await _claim_ip_slot(redis, request, settings.demo_login_cooldown_seconds, "demo")
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Demo just started, try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )

    template = find_demo_template(db)
    puuid = None if template is None else demo_summoner_puuid(db)
    if template is None or puuid is None:
        raise HTTPException(status_code=503, detail="The demo has not been seeded yet")

    user = create_demo_user(db, puuid)
    clone_template_notes(db, template, user, puuid)
    clone_template_matchups(db, template, user)
    establish_session(request, user)
    logger.info("demo_login", user_id=str(user.id), puuid=puuid)
    return _me(db, user)

def _current_demo_user(request: Request, db: Session) -> AppUser | None:
    user_id = session_user_id(request)
    if user_id is None:
        return None
    user = db.get(AppUser, user_id)
    return user if user is not None and user.provider == DEMO_PROVIDER else None

async def _claim_ip_slot(redis, request: Request, cooldown_seconds: int, key_prefix: str) -> int | None:
    client = request.client.host if request.client else None
    if redis is None or client is None or cooldown_seconds <= 0:
        return None
    key = f"{key_prefix}:cooldown:{client}"
    try:
        claimed = await redis.set(key, 1, ex=cooldown_seconds, nx=True)
        if claimed:
            return None
        return max(await redis.ttl(key), 1)
    except Exception as exc:
        logger.warning(f"{key_prefix}_cooldown_unavailable", error=str(exc))
        return None

@router.post("/guest-login", response_model=MeOut)
async def guest_login(
    request: Request, db: Session = Depends(get_db), redis=Depends(get_redis)
) -> MeOut:
    settings = get_settings()
    if not settings.guest_mode_enabled:
        raise HTTPException(status_code=404, detail="Not found")

    existing = _current_guest_user(request, db)
    if existing is not None:
        return _me(db, existing)

    retry_after = await _claim_ip_slot(redis, request, settings.guest_login_cooldown_seconds, "guest")
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Just started a guest session, try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )

    user = create_guest_user(db)
    establish_session(request, user)
    logger.info("guest_login", user_id=str(user.id))
    return _me(db, user)

def _current_guest_user(request: Request, db: Session) -> AppUser | None:
    user_id = session_user_id(request)
    if user_id is None:
        return None
    user = db.get(AppUser, user_id)
    return user if user is not None and user.provider == GUEST_PROVIDER else None

@router.post("/logout", status_code=204)
def logout(request: Request) -> Response:
    clear_session(request)
    return Response(status_code=204)

@router.get("/me", response_model=MeOut)
def me(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)) -> MeOut:
    return _me(db, user)

@router.delete("/me", status_code=204)
def delete_me(
    request: Request,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    user_id = user.id
    removed = delete_account(db, user_id)
    clear_session(request)
    logger.info("account_deleted", user_id=str(user_id), **removed)
    return Response(status_code=204)

def _me(db: Session, user: AppUser) -> MeOut:
    rows = db.execute(
        select(UserSummoner, Summoner)
        .join(Summoner, Summoner.puuid == UserSummoner.puuid)
        .where(UserSummoner.user_id == user.id)
        .order_by(UserSummoner.is_primary.desc(), UserSummoner.linked_at.asc())
    ).all()
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        provider=user.provider,
        summoners=[
            LinkedSummoner(
                puuid=link.puuid,
                game_name=summoner.game_name,
                tag_line=summoner.tag_line,
                platform=summoner.platform,
                is_primary=link.is_primary,
                verified=link.verified_at is not None,
            )
            for link, summoner in rows
        ],
    )

def _client_or_404(request: Request, provider: str):
    client = request.app.state.oauth.create_client(provider) if provider in PROFILE_READERS else None
    if client is None:
        raise HTTPException(status_code=404, detail=f"Provider {provider!r} is not configured")
    return client
