
EMPTY_RUNES: dict = {
    "primary_style_id": None,
    "primary_rune_ids": [None] * 4,
    "secondary_style_id": None,
    "secondary_rune_ids": [None] * 2,
    "stat_shard_ids": [None] * 3,
}
EMPTY_SKILL_ORDER: list[str | None] = [None] * 18

def runes(primary: int, primary_runes: list[int], secondary: int, secondary_runes: list[int], shards: list[int]) -> dict:
    return {
        "primary_style_id": primary,
        "primary_rune_ids": primary_runes,
        "secondary_style_id": secondary,
        "secondary_rune_ids": secondary_runes,
        "stat_shard_ids": shards,
    }

def skill_path(priority: str) -> list[str | None]:
    remaining = {"Q": 5, "W": 5, "E": 5}
    order: list[str | None] = []
    for level in range(1, 19):
        if level in (6, 11, 16):
            order.append("R")
            continue
        if level <= 3:
            key = priority[level - 1]
        else:
            key = next((k for k in priority if remaining[k] > 0), None)
        if key is None:
            order.append(None)
            continue
        remaining[key] -= 1
        order.append(key)
    return order

EXAMPLE_MATCHUPS: list[dict] = [
    {
        "role": "TOP",
        "your_champion_id": 122,
        "enemy_champion_id": 114,
        "tags": ["lane_bully", "strong_level_2"],
        "weaknesses": ["vulnerable_to_poke"],
        "body": (
            "Freeze near your tower until 6. She wins extended trades but you win "
            "short all-ins pre-6 if she uses W to disengage."
        ),
        "core_item_ids": [3071, 3053, 3036],
        "optional_item_ids": [3742, None, None],
        "boot_item_id": 3047,
        "optional_boot_item_id": 3111,
        "runes": runes(8000, [8010, 9111, 9104, 8299], 8400, [8446, 8451], [5008, 5010, 5011]),
        "skill_order": skill_path("QEW"),
    },
    {
        "role": "MIDDLE",
        "your_champion_id": 238,
        "enemy_champion_id": 134,
        "tags": ["scales_late"],
        "weaknesses": ["vulnerable_to_ganks"],
        "body": (
            "Respect her stun range once she hits 6 spheres. Ask jungler for early "
            "ganks, this lane snowballs hard off first blood."
        ),
        "core_item_ids": [6693, 3142, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": 3158,
        "optional_boot_item_id": None,
        "runes": runes(8100, [8112, 8143, 8138, 8135], 8200, [8210, 8237], [5008, 5008, 5013]),
        "skill_order": skill_path("QEW"),
    },
    {
        "role": "BOTTOM",
        "your_champion_id": 145,
        "enemy_champion_id": 222,
        "tags": ["engage_heavy", "poke_matchup"],
        "weaknesses": ["weak_engage"],
        "body": "Play behind minions until 6, then look for picks once Jinx overextends chasing a kill.",
        "core_item_ids": [None, None, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": None,
        "optional_boot_item_id": None,
        "runes": EMPTY_RUNES,
        "skill_order": EMPTY_SKILL_ORDER,
    },
    {
        "role": "JUNGLE",
        "your_champion_id": 64,
        "enemy_champion_id": 254,
        "tags": ["strong_level_3", "all_in_threat"],
        "weaknesses": ["mana_issues"],
        "body": (
            "She has no real counter-gank until she has R. Invade early and contest "
            "her first buff if your laners can back you up."
        ),
        "core_item_ids": [6692, 3142, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": 3158,
        "optional_boot_item_id": None,
        "runes": runes(8000, [8010, 9111, 9104, 8299], 8100, [8143, 8135], [5005, 5008, 5011]),
        "skill_order": skill_path("EQW"),
    },
    {
        "role": "UTILITY",
        "your_champion_id": 412,
        "enemy_champion_id": 111,
        "tags": ["engage_heavy", "poke_matchup"],
        "weaknesses": ["high_mechanical_skill"],
        "body": (
            "Both hooks fight for the same space. Don't stand in minion range pre-6, "
            "his engage range with Q is longer than it looks."
        ),
        "core_item_ids": [None, None, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": None,
        "optional_boot_item_id": None,
        "runes": EMPTY_RUNES,
        "skill_order": EMPTY_SKILL_ORDER,
    },
    {
        "role": "TOP",
        "your_champion_id": 164,
        "enemy_champion_id": 54,
        "tags": ["lane_bully", "scales_late"],
        "weaknesses": ["snowball_reliant"],
        "body": (
            "You out-trade him hard pre-6 with Q poke. After his first back, watch "
            "for all-in setups off his ult into your team."
        ),
        "core_item_ids": [6631, 3071, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": 3047,
        "optional_boot_item_id": None,
        "runes": EMPTY_RUNES,
        "skill_order": EMPTY_SKILL_ORDER,
    },
    {
        "role": "MIDDLE",
        "your_champion_id": 103,
        "enemy_champion_id": 777,
        "tags": ["poke_matchup"],
        "weaknesses": ["vulnerable_to_ganks"],
        "body": None,
        "core_item_ids": [None, None, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": None,
        "optional_boot_item_id": None,
        "runes": EMPTY_RUNES,
        "skill_order": EMPTY_SKILL_ORDER,
    },
    {
        "role": "BOTTOM",
        "your_champion_id": 202,
        "enemy_champion_id": 81,
        "tags": ["poke_matchup", "strong_waveclear"],
        "weaknesses": ["weak_prio"],
        "body": (
            "Ezreal pokes you out of range fast. Freeze and let him push into you "
            "instead, Jhin's 4th shot punishes him for overextending."
        ),
        "core_item_ids": [6673, None, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": 3006,
        "optional_boot_item_id": None,
        "runes": runes(8000, [8008, 9111, 9104, 8014], 8200, [8226, 8210], [5005, 5008, 5011]),
        "skill_order": skill_path("QWE"),
    },
    {
        "role": "JUNGLE",
        "your_champion_id": 104,
        "enemy_champion_id": 203,
        "tags": [],
        "weaknesses": [],
        "body": None,
        "core_item_ids": [None, None, None],
        "optional_item_ids": [None, None, None],
        "boot_item_id": None,
        "optional_boot_item_id": None,
        "runes": EMPTY_RUNES,
        "skill_order": EMPTY_SKILL_ORDER,
    },
]
