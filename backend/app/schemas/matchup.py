from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.matchup_tags import (
    ITEM_SLOTS,
    SKILL_ORDER_LENGTH,
    MatchupPlaystyleTag,
    MatchupRole,
    MatchupWeaknessTag,
)

SkillKey = Literal["Q", "W", "E", "R"]

ItemSlots = Annotated[list[int | None], Field(min_length=ITEM_SLOTS, max_length=ITEM_SLOTS)]

def _pad(values: list, length: int) -> list:
    return (list(values) + [None] * length)[:length]

class RunePage(BaseModel):
    primary_style_id: int | None = None
    primary_rune_ids: list[int | None] = Field(default_factory=lambda: [None] * 4, max_length=4)
    secondary_style_id: int | None = None
    secondary_rune_ids: list[int | None] = Field(default_factory=lambda: [None] * 2, max_length=2)
    stat_shard_ids: list[int | None] = Field(default_factory=lambda: [None] * 3, max_length=3)

    @field_validator("primary_rune_ids")
    @classmethod
    def _pad_primary(cls, v: list[int | None]) -> list[int | None]:
        return _pad(v, 4)

    @field_validator("secondary_rune_ids")
    @classmethod
    def _pad_secondary(cls, v: list[int | None]) -> list[int | None]:
        return _pad(v, 2)

    @field_validator("stat_shard_ids")
    @classmethod
    def _pad_shards(cls, v: list[int | None]) -> list[int | None]:
        return _pad(v, 3)

def _empty_skill_order() -> list[SkillKey | None]:
    return [None] * SKILL_ORDER_LENGTH

def _empty_slots() -> list[int | None]:
    return [None] * ITEM_SLOTS

class MatchupIn(BaseModel):
    role: MatchupRole
    your_champion_id: int
    enemy_champion_id: int
    tags: list[MatchupPlaystyleTag] = Field(default_factory=list)
    weaknesses: list[MatchupWeaknessTag] = Field(default_factory=list)
    body: str | None = None

    core_item_ids: ItemSlots | None = None
    optional_item_ids: ItemSlots | None = None
    boot_item_id: int | None = None
    optional_boot_item_id: int | None = None
    runes: RunePage | None = None
    skill_order: list[SkillKey | None] | None = Field(default=None, max_length=SKILL_ORDER_LENGTH)

    @field_validator("tags", "weaknesses")
    @classmethod
    def _no_duplicates(cls, v: list) -> list:
        if len(set(v)) != len(v):
            raise ValueError("duplicate tag")
        return v

    @field_validator("skill_order")
    @classmethod
    def _pad_skill_order(cls, v: list | None) -> list | None:
        return None if v is None else _pad(v, SKILL_ORDER_LENGTH)

class MatchupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: MatchupRole
    your_champion_id: int
    enemy_champion_id: int
    tags: list[MatchupPlaystyleTag]
    weaknesses: list[MatchupWeaknessTag]
    body: str | None
    core_item_ids: list[int | None] = Field(default_factory=_empty_slots)
    optional_item_ids: list[int | None] = Field(default_factory=_empty_slots)
    boot_item_id: int | None = None
    optional_boot_item_id: int | None = None
    runes: RunePage = Field(default_factory=RunePage)
    skill_order: list[SkillKey | None] = Field(default_factory=_empty_skill_order)
    created_at: datetime
    updated_at: datetime

class MatchupTagTaxonomy(BaseModel):
    tag_key: MatchupPlaystyleTag
    label: str

class MatchupWeaknessTaxonomy(BaseModel):
    tag_key: MatchupWeaknessTag
    label: str
