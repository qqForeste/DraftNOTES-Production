import pytest
from pydantic import ValidationError

from app.config import Settings

PROD = dict(
    _env_file=None,
    env="production",
    database_url="postgresql+psycopg://u:p@ep-cool.eu-central-1.aws.neon.tech:5432/draftnotes",
    redis_url="rediss://default:token@fly-draftnotes.upstash.io:6379",
    riot_api_key="RGAPI-test",
    cors_origins="https://draftnotes.gg",
    session_secret="a-real-secret-from-the-secret-store",
    google_client_id="gid",
    google_client_secret="gsecret",
    oauth_redirect_base_url="https://draftnotes.gg",
)

def test_production_config_with_real_values_is_accepted():
    settings = Settings(**PROD)
    assert settings.is_production
    assert settings.cors_origin_list == ["https://draftnotes.gg"]

@pytest.mark.parametrize(
    "override, expected",
    [
        ({"database_url": "postgresql+psycopg://u:p@localhost:5432/draftnotes"}, "local database"),
        ({"database_url": "postgresql+psycopg://u:p@127.0.0.1:5432/draftnotes"}, "local database"),
        ({"redis_url": "redis://localhost:6379/0"}, "local Redis"),
        ({"use_fixtures": True}, "recorded data"),
        ({"riot_api_key": None}, "RIOT_API_KEY"),
        ({"cors_origins": ""}, "CORS_ORIGINS is empty"),
        ({"cors_origins": "http://localhost:5173"}, "allows localhost"),
        ({"dev_login_enabled": True}, "DEV_LOGIN_ENABLED"),
        ({"session_secret": "dev-only-insecure-session-secret"}, "SESSION_SECRET"),
        ({"google_client_id": None}, "no OAuth provider"),
        ({"oauth_redirect_base_url": None}, "OAUTH_REDIRECT_BASE_URL"),
    ],
)
def test_production_rejects_dev_defaults(override, expected):
    with pytest.raises(ValidationError, match=expected):
        Settings(**{**PROD, **override})

def test_production_reports_every_problem_at_once():
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None, env="production", cors_origins="")
    message = str(exc.value)
    assert "local database" in message
    assert "RIOT_API_KEY" in message
    assert "CORS_ORIGINS is empty" in message

def test_development_captures_fixtures_and_logs_for_humans():
    settings = Settings(_env_file=None, env="development")
    assert settings.capture_fixtures is True
    assert settings.log_json is False
    assert settings.dev_login_enabled is True
    assert settings.session_cookie_secure is False

def test_production_closes_the_dev_login_door():
    settings = Settings(**PROD)
    assert settings.dev_login_enabled is False
    assert settings.session_cookie_secure is True

def test_enabled_providers_needs_both_halves_of_a_credential():
    assert Settings(_env_file=None, google_client_id="gid").enabled_oauth_providers == []
    both = Settings(_env_file=None, discord_client_id="d", discord_client_secret="s")
    assert both.enabled_oauth_providers == ["discord"]

def test_production_never_writes_fixtures_to_disk():
    settings = Settings(**PROD)
    assert settings.capture_fixtures is False
    assert settings.log_json is True

def test_explicit_capture_fixtures_wins_over_env_default():
    settings = Settings(**{**PROD, "capture_fixtures": True})
    assert settings.capture_fixtures is True

def test_cors_origins_splits_and_strips():
    settings = Settings(_env_file=None, cors_origins="https://a.gg, https://b.gg ,")
    assert settings.cors_origin_list == ["https://a.gg", "https://b.gg"]
