from fastapi import APIRouter
from pydantic import BaseModel

from app.tags import MISTAKE_TAG_LABELS, GamePhase, MistakeTag

router = APIRouter(prefix="/api/tags", tags=["tags"])

class TagTaxonomy(BaseModel):
    tag_key: MistakeTag
    label: str

@router.get("", response_model=list[TagTaxonomy])
def list_tags() -> list[TagTaxonomy]:
    return [TagTaxonomy(tag_key=key, label=label) for key, label in MISTAKE_TAG_LABELS.items()]

@router.get("/phases", response_model=list[GamePhase])
def list_phases() -> list[GamePhase]:
    return list(GamePhase)
