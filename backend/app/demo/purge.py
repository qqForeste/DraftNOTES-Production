
from app.config import get_settings
from app.services.demo import purge_expired_demo_users

def main() -> None:
    from app.db import SessionLocal

    settings = get_settings()
    with SessionLocal() as db:
        removed = purge_expired_demo_users(db, settings.demo_user_ttl_days)
    print(f"Purged {removed} demo accounts older than {settings.demo_user_ttl_days}d.")

if __name__ == "__main__":
    main()
