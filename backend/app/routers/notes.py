from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_summoner, get_current_user
from app.models import AppUser, Note, NoteTag, Participant, Summoner
from app.schemas.note import NoteIn, NoteOut

router = APIRouter(prefix="/api/matches", tags=["notes"])

@router.put("/{match_id}/note", response_model=NoteOut)
def upsert_note(
    match_id: str,
    payload: NoteIn,
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> Note:
    participant = db.get(Participant, (match_id, summoner.puuid))
    if participant is None:
        raise HTTPException(status_code=404, detail="Match not found for current summoner")

    note = _find_note(db, user, match_id, summoner.puuid)
    if note is None:
        note = Note(user_id=user.id, match_id=match_id, puuid=summoner.puuid)
        db.add(note)

    note.body = payload.body
    note.tags = [
        NoteTag(tag_key=t.tag_key, phase=t.phase, timestamp_seconds=t.timestamp_seconds)
        for t in payload.tags
    ]
    db.commit()
    db.refresh(note)
    return note

@router.delete("/{match_id}/note", status_code=204)
def delete_note(
    match_id: str,
    user: AppUser = Depends(get_current_user),
    summoner: Summoner = Depends(get_current_summoner),
    db: Session = Depends(get_db),
) -> Response:
    note = _find_note(db, user, match_id, summoner.puuid)
    if note is not None:
        db.delete(note)
        db.commit()
    return Response(status_code=204)

def _find_note(db: Session, user: AppUser, match_id: str, puuid: str) -> Note | None:
    return db.execute(
        select(Note).where(
            Note.user_id == user.id, Note.match_id == match_id, Note.puuid == puuid
        )
    ).scalar_one_or_none()
