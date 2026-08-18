from enum import Enum

class MatchupRole(str, Enum):
    TOP = "TOP"
    JUNGLE = "JUNGLE"
    MIDDLE = "MIDDLE"
    BOTTOM = "BOTTOM"
    UTILITY = "UTILITY"

class MatchupPlaystyleTag(str, Enum):
    LANE_BULLY = "lane_bully"
    WINS_LEVEL_1 = "wins_level_1"
    STRONG_LEVEL_2 = "strong_level_2"
    STRONG_LEVEL_3 = "strong_level_3"
    STRONG_LEVEL_6 = "strong_level_6"
    SCALES_LATE = "scales_late"
    ALL_IN_THREAT = "all_in_threat"
    POKE_MATCHUP = "poke_matchup"
    ENGAGE_HEAVY = "engage_heavy"
    STRONG_WAVECLEAR = "strong_waveclear"
    SUSTAIN_LANE = "sustain_lane"
    STRONG_PRIO = "strong_prio"

class MatchupWeaknessTag(str, Enum):
    VULNERABLE_TO_POKE = "vulnerable_to_poke"
    VULNERABLE_TO_GANKS = "vulnerable_to_ganks"
    WEAK_AGAINST_TANKS = "weak_against_tanks"
    WEAK_ENGAGE = "weak_engage"
    WEAK_WAVECLEAR = "weak_waveclear"
    MANA_ISSUES = "mana_issues"
    POOR_SCALING = "poor_scaling"
    SNOWBALL_RELIANT = "snowball_reliant"
    HIGH_MECHANICAL_SKILL = "high_mechanical_skill"
    WEAK_PRIO = "weak_prio"
    WEAK_WHEN_BEHIND = "weak_when_behind"

PLAYSTYLE_TAG_LABELS: dict[MatchupPlaystyleTag, str] = {
    MatchupPlaystyleTag.LANE_BULLY: "Lane bully",
    MatchupPlaystyleTag.WINS_LEVEL_1: "Wins Lvl 1",
    MatchupPlaystyleTag.STRONG_LEVEL_2: "Strong at 2",
    MatchupPlaystyleTag.STRONG_LEVEL_3: "Strong at 3",
    MatchupPlaystyleTag.STRONG_LEVEL_6: "Strong at 6",
    MatchupPlaystyleTag.SCALES_LATE: "Scales late",
    MatchupPlaystyleTag.ALL_IN_THREAT: "All in threat",
    MatchupPlaystyleTag.POKE_MATCHUP: "Poke matchup",
    MatchupPlaystyleTag.ENGAGE_HEAVY: "Engage heavy",
    MatchupPlaystyleTag.STRONG_WAVECLEAR: "Strong waveclear",
    MatchupPlaystyleTag.SUSTAIN_LANE: "Sustain lane",
    MatchupPlaystyleTag.STRONG_PRIO: "Strong prio",
}

WEAKNESS_TAG_LABELS: dict[MatchupWeaknessTag, str] = {
    MatchupWeaknessTag.VULNERABLE_TO_POKE: "Vulnerable to poke",
    MatchupWeaknessTag.VULNERABLE_TO_GANKS: "Vulnerable to ganks",
    MatchupWeaknessTag.WEAK_AGAINST_TANKS: "Weak against tanks",
    MatchupWeaknessTag.WEAK_ENGAGE: "Weak engage",
    MatchupWeaknessTag.WEAK_WAVECLEAR: "Weak waveclear",
    MatchupWeaknessTag.MANA_ISSUES: "Mana Issues",
    MatchupWeaknessTag.POOR_SCALING: "Poor scaling",
    MatchupWeaknessTag.SNOWBALL_RELIANT: "Snowball reliant",
    MatchupWeaknessTag.HIGH_MECHANICAL_SKILL: "High mechanical skill",
    MatchupWeaknessTag.WEAK_PRIO: "Weak prio",
    MatchupWeaknessTag.WEAK_WHEN_BEHIND: "Weak when behind",
}

SKILL_ORDER_LENGTH = 18
ITEM_SLOTS = 3
