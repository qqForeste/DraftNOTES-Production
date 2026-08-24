
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import GUEST_PROVIDER
from app.models import AppUser

def create_guest_user(db: Session) -> AppUser:
    user = AppUser(
        provider=GUEST_PROVIDER,
        oauth_sub=uuid.uuid4().hex,
        display_name="Guest",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def purge_expired_guest_users(db: Session, ttl_days: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    ids = (
        db.execute(
            select(AppUser.id).where(
                AppUser.provider == GUEST_PROVIDER,
                AppUser.created_at < cutoff,
            )
        )
        .scalars()
        .all()
    )
    if not ids:
        return 0
    db.execute(delete(AppUser).where(AppUser.id.in_(ids)))
    db.commit()
    return len(ids)
