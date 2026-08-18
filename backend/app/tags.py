from enum import Enum

class MistakeTag(str, Enum):
    DIED_TO_GANK = "died_to_gank"
    OVEREXTENDED = "overextended"
    MISSED_WAVE = "missed_wave"
    BAD_RECALL_TIMING = "bad_recall_timing"
    BAD_TEAMFIGHT = "bad_teamfight"
    TILTED = "tilted"
    MECHANICAL_MISPLAY = "mechanical_misplay"
    NO_MAP_AWARENESS = "no_map_awareness"

MISTAKE_TAG_LABELS: dict[MistakeTag, str] = {
    MistakeTag.DIED_TO_GANK: "Died to gank",
    MistakeTag.OVEREXTENDED: "Overextended",
    MistakeTag.MISSED_WAVE: "Missed Wave(s)",
    MistakeTag.BAD_RECALL_TIMING: "Bad recall timing",
    MistakeTag.BAD_TEAMFIGHT: "Bad teamfight",
    MistakeTag.TILTED: "Tilted",
    MistakeTag.MECHANICAL_MISPLAY: "Mechanical Misplay",
    MistakeTag.NO_MAP_AWARENESS: "No map awareness",
}

RETIRED_TAG_REMAP: dict[str, str] = {
    "overextended_no_vision": MistakeTag.OVEREXTENDED.value,
    "tilted_after_death": MistakeTag.TILTED.value,
    "misplayed_teamfight_position": MistakeTag.BAD_TEAMFIGHT.value,
    "forced_fight_no_summs": MistakeTag.BAD_TEAMFIGHT.value,
    "poor_objective_setup": MistakeTag.NO_MAP_AWARENESS.value,
    "wrong_item_build": MistakeTag.MECHANICAL_MISPLAY.value,
}

class GamePhase(str, Enum):
    EARLY = "early"
    MID = "mid"
    LATE = "late"
