import uuid

from authlib.integrations.starlette_client import OAuth
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.config import Settings
from app.models import AppUser

SESSION_USER_KEY = "user_id"

LEGACY_PROVIDER = "legacy"
DEV_PROVIDER = "dev"
DEMO_PROVIDER = "demo"
GUEST_PROVIDER = "guest"

DEMO_TEMPLATE_SUB = "template"

def build_oauth(settings: Settings) -> OAuth:
    oauth = OAuth()
    if settings.google_client_id and settings.google_client_secret:
        oauth.register(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
    if settings.discord_client_id and settings.discord_client_secret:
        oauth.register(
            name="discord",
            client_id=settings.discord_client_id,
            client_secret=settings.discord_client_secret,
            authorize_url="https://discord.com/oauth2/authorize",
            access_token_url="https://discord.com/api/oauth2/token",
            api_base_url="https://discord.com/api/",
            client_kwargs={"scope": "identify email"},
        )
    return oauth

async def profile_from_google(token: dict, client) -> tuple[str, str | None, str | None]:
    claims = token.get("userinfo")
    if not claims:
        resp = await client.get("https://openidconnect.googleapis.com/v1/userinfo", token=token)
        resp.raise_for_status()
        claims = resp.json()
    return claims["sub"], claims.get("email"), claims.get("name")

async def profile_from_discord(token: dict, client) -> tuple[str, str | None, str | None]:
    resp = await client.get("users/@me", token=token)
    resp.raise_for_status()
    me = resp.json()
    return me["id"], me.get("email"), me.get("global_name") or me.get("username")

def get_or_create_user(
    db: Session,
    provider: str,
    oauth_sub: str,
    email: str | None = None,
    display_name: str | None = None,
) -> AppUser:
    user = db.execute(
        select(AppUser).where(AppUser.provider == provider, AppUser.oauth_sub == oauth_sub)
    ).scalar_one_or_none()
    if user is None:
        user = AppUser(
            provider=provider, oauth_sub=oauth_sub, email=email, display_name=display_name
        )
        db.add(user)
    else:
        user.email = email or user.email
        user.display_name = display_name or user.display_name
    db.commit()
    db.refresh(user)
    return user

def establish_session(request: Request, user: AppUser) -> None:
    request.session[SESSION_USER_KEY] = str(user.id)

def clear_session(request: Request) -> None:
    request.session.clear()

def session_user_id(request: Request) -> uuid.UUID | None:
    raw = request.session.get(SESSION_USER_KEY)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except (ValueError, AttributeError, TypeError):
        return None
