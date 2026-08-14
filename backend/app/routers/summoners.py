from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import DEMO_PROVIDER
from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_summoner, get_current_user, get_sync_queue
from app.models import AppUser, Summoner
from app.schemas.summoner import SummonerOut, SyncEnqueued, SyncJobOut, SyncRequest
from app.services.aggregation import get_latest_profile_icon_id
from app.services.sync_queue import SyncQueue

router = APIRouter(prefix="/api/summoners", tags=["summoners"])

def _to_summoner_out(db: Session, summoner: Summoner) -> SummonerOut:
    out = SummonerOut.model_validate(summoner)
    out.profile_icon_id = get_latest_profile_icon_id(db, summoner.puuid)
    return out

@router.post("/sync", response_model=SyncEnqueued, status_code=202)
async def sync(
    payload: SyncRequest,
    user: AppUser = Depends(get_current_user),
    queue: SyncQueue = Depends(get_sync_queue),
) -> SyncEnqueued:
    settings = get_settings()
    if user.provider == DEMO_PROVIDER:
        raise HTTPException(
            status_code=403,
            detail="Sync is disabled in the demo. Sign in to link your own Riot ID.",
        )

    depth = await queue.depth()
    if depth >= settings.sync_max_queue_depth:
        raise HTTPException(status_code=503, detail="Sync queue is full, try again shortly")

    retry_after = await queue.claim_slot(user.id)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Already synced recently, try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )

    enqueued = await queue.enqueue(user.id, payload.platform, payload.game_name, payload.tag_line)
    return SyncEnqueued(
        job_id=enqueued.job_id, status="queued", queue_position=enqueued.queue_position
    )

@router.get("/sync/{job_id}", response_model=SyncJobOut)
async def sync_status(
    job_id: str,
    user: AppUser = Depends(get_current_user),
    queue: SyncQueue = Depends(get_sync_queue),
) -> SyncJobOut:
    state = await queue.state(job_id)
    if state.status == "not_found":
        raise HTTPException(status_code=404, detail="No such sync job")
    return SyncJobOut(
        job_id=state.job_id,
        status=state.status,
        matches_seen=state.matches_seen,
        matches_new=state.matches_new,
        error=state.error,
    )

@router.get("/me", response_model=SummonerOut)
def get_me(summoner: Summoner = Depends(get_current_summoner), db: Session = Depends(get_db)) -> SummonerOut:
    return _to_summoner_out(db, summoner)

@router.get("/{puuid}", response_model=SummonerOut)
def get_summoner(
    puuid: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SummonerOut:
    summoner = db.get(Summoner, puuid)
    if summoner is None:
        raise HTTPException(status_code=404, detail="Unknown summoner")
    return _to_summoner_out(db, summoner)
