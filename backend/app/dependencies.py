from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.auth import session_user_id
from app.db import get_db
from app.models import AppUser, Summoner
from app.services.linking import primary_puuid
from app.services.sync_queue import (
    LookupQueue,
    OlderMatchesQueue,
    PinnedQueue,
    ResolveQueue,
    SyncQueue,
)

def get_sync_queue(request: Request) -> SyncQueue:
    return request.app.state.sync_queue

def get_pinned_queue(request: Request) -> PinnedQueue:
    return request.app.state.pinned_queue

def get_lookup_queue(request: Request) -> LookupQueue:
    return request.app.state.lookup_queue

def get_resolve_queue(request: Request) -> ResolveQueue:
    return request.app.state.resolve_queue

def get_older_matches_queue(request: Request) -> OlderMatchesQueue:
    return request.app.state.older_matches_queue

def get_redis(request: Request):
    return getattr(request.app.state, "redis", None)

def get_optional_user(request: Request, db: Session = Depends(get_db)) -> AppUser | None:
    user_id = session_user_id(request)
    if user_id is None:
        return None
    return db.get(AppUser, user_id)

def get_current_user(user: AppUser | None = Depends(get_optional_user)) -> AppUser:
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return user

def get_current_summoner(
    user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> Summoner:
    puuid = primary_puuid(db, user.id)
    if puuid is None:
        raise HTTPException(status_code=404, detail="No Riot ID linked yet")
    summoner = db.get(Summoner, puuid)
    if summoner is None:
        raise HTTPException(status_code=404, detail="Linked Riot ID has not been synced yet")
    return summoner

def get_target_summoner(
    puuid: str | None = Query(default=None),
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Summoner:
    if puuid is None:
        return get_current_summoner(user, db)
    summoner = db.get(Summoner, puuid)
    if summoner is None:
        raise HTTPException(status_code=404, detail="Unknown summoner")
    return summoner
