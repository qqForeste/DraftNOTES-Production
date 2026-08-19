from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user, get_pinned_queue
from app.models import AppUser
from app.riot.platforms import PLATFORM_TO_CONTINENT
from app.schemas.pinned import (
    PinnedNoteIn,
    PinnedSyncEnqueued,
    PinnedSyncJob,
    PinnedSyncRequest,
    PinnedUserOut,
)
from app.services import pinned as service
from app.services.demo import DEMO_PROVIDER
from app.services.sync_queue import PinnedQueue

router = APIRouter(prefix="/api/pinned", tags=["pinned"])

@router.get("", response_model=list[PinnedUserOut])
def list_pinned(
    user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PinnedUserOut]:
    return [service.to_out(db, p) for p in service.list_pinned(db, user.id)]

@router.post("/sync", response_model=PinnedSyncEnqueued, status_code=202)
async def sync_pinned(
    payload: PinnedSyncRequest,
    user: AppUser = Depends(get_current_user),
    queue: PinnedQueue = Depends(get_pinned_queue),
    db: Session = Depends(get_db),
) -> PinnedSyncEnqueued:
    settings = get_settings()
    if user.provider == DEMO_PROVIDER:
        raise HTTPException(
            status_code=403,
            detail="Pinning is disabled in the demo. Sign in to track other players.",
        )
    if payload.platform not in PLATFORM_TO_CONTINENT:
        raise HTTPException(status_code=422, detail=f"Unknown platform {payload.platform!r}")

    if service.count_pinned(db, user.id) >= settings.pinned_max_per_user:
        raise HTTPException(
            status_code=409,
            detail=f"You can pin at most {settings.pinned_max_per_user} players",
        )
    depth = await queue.depth()
    if depth >= settings.sync_max_queue_depth:
        raise HTTPException(status_code=503, detail="Sync queue is full, try again shortly")

    retry_after = await queue.claim_slot(
        user.id, payload.platform, payload.game_name, payload.tag_line
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Already refreshed recently, try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )

    enqueued = await queue.enqueue(
        user.id, payload.platform, payload.game_name, payload.tag_line
    )
    return PinnedSyncEnqueued(
        job_id=enqueued.job_id, status="queued", queue_position=enqueued.queue_position
    )

@router.get("/sync/{job_id}", response_model=PinnedSyncJob)
async def pinned_sync_job(
    job_id: str,
    user: AppUser = Depends(get_current_user),
    queue: PinnedQueue = Depends(get_pinned_queue),
) -> PinnedSyncJob:
    state = await queue.state(job_id)
    if state.status == "not_found":
        raise HTTPException(status_code=404, detail="Unknown job")
    return PinnedSyncJob(
        job_id=state.job_id,
        status=state.status,
        pinned_id=state.pinned_id,
        error=state.error,
    )

@router.get("/{pinned_id}", response_model=PinnedUserOut)
def get_pinned(
    pinned_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PinnedUserOut:
    pinned = service.get_pinned(db, user.id, pinned_id)
    if pinned is None:
        raise HTTPException(status_code=404, detail="Not pinned")
    return service.to_out(db, pinned)

@router.put("/{pinned_id}/note", response_model=PinnedUserOut)
def update_note(
    pinned_id: int,
    payload: PinnedNoteIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PinnedUserOut:
    pinned = service.get_pinned(db, user.id, pinned_id)
    if pinned is None:
        raise HTTPException(status_code=404, detail="Not pinned")
    pinned.note = payload.note
    db.commit()
    db.refresh(pinned)
    return service.to_out(db, pinned)

@router.delete("/{pinned_id}", status_code=204)
def delete_pinned(
    pinned_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    pinned = service.get_pinned(db, user.id, pinned_id)
    if pinned is None:
        raise HTTPException(status_code=404, detail="Not pinned")
    db.delete(pinned)
    db.commit()
    return Response(status_code=204)
