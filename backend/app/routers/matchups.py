from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.matchup_tags import PLAYSTYLE_TAG_LABELS, WEAKNESS_TAG_LABELS
from app.models import AppUser
from app.schemas.matchup import (
    MatchupIn,
    MatchupOut,
    MatchupTagTaxonomy,
    MatchupWeaknessTaxonomy,
)
from app.services import matchups as service

router = APIRouter(prefix="/api/matchups", tags=["matchups"])

@router.get("/tags", response_model=list[MatchupTagTaxonomy])
def list_playstyle_tags() -> list[MatchupTagTaxonomy]:
    return [
        MatchupTagTaxonomy(tag_key=key, label=label)
        for key, label in PLAYSTYLE_TAG_LABELS.items()
    ]

@router.get("/weaknesses", response_model=list[MatchupWeaknessTaxonomy])
def list_weakness_tags() -> list[MatchupWeaknessTaxonomy]:
    return [
        MatchupWeaknessTaxonomy(tag_key=key, label=label)
        for key, label in WEAKNESS_TAG_LABELS.items()
    ]

@router.get("", response_model=list[MatchupOut])
def list_matchups(
    user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[MatchupOut]:
    return [service.to_out(m) for m in service.list_matchups(db, user.id)]

@router.post("", response_model=MatchupOut, status_code=201)
def create_matchup(
    payload: MatchupIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MatchupOut:
    existing = service.find_pair(db, user.id, payload)
    if existing is not None:
        return service.to_out(service.update_matchup(db, existing, payload))
    return service.to_out(service.create_matchup(db, user.id, payload))

@router.put("/{matchup_id}", response_model=MatchupOut)
def update_matchup(
    matchup_id: int,
    payload: MatchupIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MatchupOut:
    matchup = service.get_matchup(db, user.id, matchup_id)
    if matchup is None:
        raise HTTPException(status_code=404, detail="Matchup not found")
    clash = service.find_pair(db, user.id, payload)
    if clash is not None and clash.id != matchup.id:
        raise HTTPException(
            status_code=409, detail="You already have a matchup for that pairing"
        )
    return service.to_out(service.update_matchup(db, matchup, payload))

@router.delete("/{matchup_id}", status_code=204)
def delete_matchup(
    matchup_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    matchup = service.get_matchup(db, user.id, matchup_id)
    if matchup is None:
        raise HTTPException(status_code=404, detail="Matchup not found")
    service.delete_matchup(db, matchup)
    return Response(status_code=204)
