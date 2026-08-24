
from app.tags import GamePhase, MistakeTag

DemoTag = tuple[MistakeTag, GamePhase, int | None]

EXAMPLE_NOTES: list[dict] = [
    {
        "index": 0,
        "body": "Example note. Wave was pushed in and the recall came a beat late, "
        "so the next two waves bounced back under tower.",
        "tags": [
            (MistakeTag.BAD_RECALL_TIMING, GamePhase.EARLY, 320),
            (MistakeTag.MISSED_WAVE, GamePhase.EARLY, None),
        ],
    },
    {
        "index": 1,
        "body": "Example note. Pushed past the river ward with both enemy junglers' "
        "positions unknown.",
        "tags": [
            (MistakeTag.OVEREXTENDED, GamePhase.EARLY, 240),
            (MistakeTag.DIED_TO_GANK, GamePhase.EARLY, 265),
        ],
    },
    {
        "index": 3,
        "body": "Example note. Drake started without vision on the pit or a lane "
        "advantage to trade for it.",
        "tags": [(MistakeTag.NO_MAP_AWARENESS, GamePhase.MID, 900)],
    },
    {
        "index": 5,
        "body": "Example note. Stepped in front of the frontline in the first "
        "teamfight and got picked before dealing damage.",
        "tags": [
            (MistakeTag.BAD_TEAMFIGHT, GamePhase.MID, 1140),
        ],
    },
    {
        "index": 8,
        "body": "Example note. Side lane was pushing with no map check before "
        "committing to the fight.",
        "tags": [
            (MistakeTag.NO_MAP_AWARENESS, GamePhase.MID, None),
            (MistakeTag.OVEREXTENDED, GamePhase.MID, 1020),
        ],
    },
    {
        "index": 11,
        "body": "Example note. Build went for damage into a heavy-shield comp where "
        "the cut item was worth more.",
        "tags": [(MistakeTag.MECHANICAL_MISPLAY, GamePhase.LATE, None)],
    },
    {
        "index": 14,
        "body": "Example note. Baron thrown at 32 minutes without a vision sweep first.",
        "tags": [
            (MistakeTag.NO_MAP_AWARENESS, GamePhase.LATE, 1920),
            (MistakeTag.BAD_TEAMFIGHT, GamePhase.LATE, 1945),
        ],
    },
    {
        "index": 17,
        "body": "Example note. Went straight back to lane after dying instead of "
        "resetting, and lost the wave too.",
        "tags": [
            (MistakeTag.TILTED, GamePhase.EARLY, 410),
            (MistakeTag.MISSED_WAVE, GamePhase.EARLY, None),
        ],
    },
]
