from fastapi import APIRouter, Depends, HTTPException

from app.auth import DEMO_PROVIDER
from app.config import get_settings
from app.dependencies import get_current_user, get_lookup_queue, get_resolve_queue
from app.models import AppUser
from app.riot.platforms import PLATFORM_TO_CONTINENT
from app.schemas.lookup import (
    LookupResolveEnqueued,
    LookupResolveJob,
    LookupSyncEnqueued,
    LookupSyncJob,
    LookupSyncRequest,
)
from app.services.sync_queue import LookupQueue, ResolveQueue

router = APIRouter(prefix="/api/lookup", tags=["lookup"])

@router.post("/resolve", response_model=LookupResolveEnqueued, status_code=202)
async def lookup_resolve(
    payload: LookupSyncRequest,
    user: AppUser = Depends(get_current_user),
    queue: ResolveQueue = Depends(get_resolve_queue),
) -> LookupResolveEnqueued:
    settings = get_settings()
    if user.provider == DEMO_PROVIDER:
        raise HTTPException(
            status_code=403,
            detail="Looking up other accounts is disabled in the demo. Sign in to search.",
        )
    if payload.platform not in PLATFORM_TO_CONTINENT:
        raise HTTPException(status_code=422, detail=f"Unknown platform {payload.platform!r}")

    depth = await queue.depth()
    if depth >= settings.sync_max_queue_depth:
        raise HTTPException(status_code=503, detail="Sync queue is full, try again shortly")

    enqueued = await queue.enqueue(payload.platform, payload.game_name, payload.tag_line)
    return LookupResolveEnqueued(
        job_id=enqueued.job_id, status="queued", queue_position=enqueued.queue_position
    )

@router.get("/resolve/{job_id}", response_model=LookupResolveJob)
async def lookup_resolve_job(
    job_id: str,
    user: AppUser = Depends(get_current_user),
    queue: ResolveQueue = Depends(get_resolve_queue),
) -> LookupResolveJob:
    state = await queue.state(job_id)
    if state.status == "not_found":
        raise HTTPException(status_code=404, detail="Unknown job")
    return LookupResolveJob(
        job_id=state.job_id,
        status=state.status,
        puuid=state.puuid,
        error=state.error,
    )

@router.post("/sync", response_model=LookupSyncEnqueued, status_code=202)
async def lookup_sync(
    payload: LookupSyncRequest,
    user: AppUser = Depends(get_current_user),
    queue: LookupQueue = Depends(get_lookup_queue),
) -> LookupSyncEnqueued:
    settings = get_settings()
    if user.provider == DEMO_PROVIDER:
        raise HTTPException(
            status_code=403,
            detail="Looking up other accounts is disabled in the demo. Sign in to search.",
        )
    if payload.platform not in PLATFORM_TO_CONTINENT:
        raise HTTPException(status_code=422, detail=f"Unknown platform {payload.platform!r}")

    depth = await queue.depth()
    if depth >= settings.sync_max_queue_depth:
        raise HTTPException(status_code=503, detail="Sync queue is full, try again shortly")

    retry_after = await queue.claim_slot(
        user.id, payload.platform, payload.game_name, payload.tag_line
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Already looked up recently, try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )

    enqueued = await queue.enqueue(
        user.id, payload.platform, payload.game_name, payload.tag_line
    )
    return LookupSyncEnqueued(
        job_id=enqueued.job_id, status="queued", queue_position=enqueued.queue_position
    )

@router.get("/sync/{job_id}", response_model=LookupSyncJob)
async def lookup_sync_job(
    job_id: str,
    user: AppUser = Depends(get_current_user),
    queue: LookupQueue = Depends(get_lookup_queue),
) -> LookupSyncJob:
    state = await queue.state(job_id)
    if state.status == "not_found":
        raise HTTPException(status_code=404, detail="Unknown job")
    return LookupSyncJob(
        job_id=state.job_id,
        status=state.status,
        puuid=state.puuid,
        error=state.error,
    )
