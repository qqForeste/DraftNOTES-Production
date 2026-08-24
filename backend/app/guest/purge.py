
from app.config import get_settings
from app.services.guest import purge_expired_guest_users

def main() -> None:
    from app.db import SessionLocal

    settings = get_settings()
    with SessionLocal() as db:
        removed = purge_expired_guest_users(db, settings.guest_user_ttl_days)
    print(f"Purged {removed} guest accounts older than {settings.guest_user_ttl_days}d.")

if __name__ == "__main__":
    main()
