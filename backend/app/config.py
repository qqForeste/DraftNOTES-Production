from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_HOSTS = ("localhost", "127.0.0.1")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["development", "production"] = "development"

    database_url: str = "postgresql+psycopg://draftnotes:draftnotes@localhost:5432/draftnotes"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle_seconds: int = 300

    redis_url: str = "redis://localhost:6379/0"
    sync_queue_name: str = "sync:default"
    sync_cooldown_seconds: int = 60
    sync_max_queue_depth: int = 500
    sync_worker_concurrency: int = 5
    sync_poll_delay_seconds: float = 1.0
    sync_match_count: int = 20
    legacy_scoreboard_widen_batch: int = 10

    rank_cache_ttl_hours: int = 24
    scoreboard_rank_enrich_matches: int = 5
    sync_rank_call_budget: int = 30

    pinned_max_per_user: int = 20
    pinned_recent_match_count: int = 6
    pinned_refresh_cooldown_seconds: int = 300

    lookup_cooldown_seconds: int = 60

    older_matches_batch_size: int = 20
    older_matches_cooldown_seconds: int = 15

    cors_origins: str = "http://localhost:5173"

    log_level: str = "INFO"
    log_json: bool | None = None

    session_secret: str = "dev-only-insecure-session-secret"
    session_max_age_seconds: int = 60 * 60 * 24 * 30
    session_cookie_secure: bool | None = None

    google_client_id: str | None = None
    google_client_secret: str | None = None
    discord_client_id: str | None = None
    discord_client_secret: str | None = None

    frontend_url: str = "http://localhost:5173"
    oauth_redirect_base_url: str | None = None

    dev_login_enabled: bool | None = None

    demo_mode_enabled: bool = True
    demo_login_cooldown_seconds: int = 30
    demo_user_ttl_days: int = 7

    guest_mode_enabled: bool = True
    guest_login_cooldown_seconds: int = 30
    guest_user_ttl_days: int = 7

    riot_api_key: str | None = None

    use_fixtures: bool = False
    capture_fixtures: bool | None = None
    fixtures_dir: Path = Path("./fixtures")

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _resolve_env_dependent_defaults(self) -> "Settings":
        if self.capture_fixtures is None:
            self.capture_fixtures = not self.is_production
        if self.log_json is None:
            self.log_json = self.is_production
        if self.dev_login_enabled is None:
            self.dev_login_enabled = not self.is_production
        if self.session_cookie_secure is None:
            self.session_cookie_secure = self.is_production
        return self

    @property
    def enabled_oauth_providers(self) -> list[str]:
        configured = {
            "google": self.google_client_id and self.google_client_secret,
            "discord": self.discord_client_id and self.discord_client_secret,
        }
        return [name for name, ready in configured.items() if ready]

    @model_validator(mode="after")
    def _reject_dev_defaults_in_production(self) -> "Settings":
        if not self.is_production:
            return self

        problems = []
        if any(host in self.database_url for host in LOCAL_HOSTS):
            problems.append("DATABASE_URL points at a local database")
        if any(host in self.redis_url for host in LOCAL_HOSTS):
            problems.append("REDIS_URL points at a local Redis")
        if self.use_fixtures:
            problems.append("USE_FIXTURES=true would serve recorded data")
        if not self.riot_api_key:
            problems.append("RIOT_API_KEY is not set")
        if not self.cors_origin_list:
            problems.append("CORS_ORIGINS is empty")
        if any("localhost" in origin for origin in self.cors_origin_list):
            problems.append("CORS_ORIGINS still allows localhost")
        if self.dev_login_enabled:
            problems.append("DEV_LOGIN_ENABLED=true would let anyone sign in as anyone")
        if self.session_secret == Settings.model_fields["session_secret"].default:
            problems.append("SESSION_SECRET is still the shipped default")
        if not self.enabled_oauth_providers:
            problems.append("no OAuth provider is configured, nobody could sign in")
        if not self.oauth_redirect_base_url:
            problems.append("OAUTH_REDIRECT_BASE_URL is not set")
        if problems:
            raise ValueError("ENV=production but " + "; ".join(problems))
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
