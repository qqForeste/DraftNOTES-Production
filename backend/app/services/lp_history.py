
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RankSnapshot

TIERS = (
    "IRON",
    "BRONZE",
    "SILVER",
    "GOLD",
    "PLATINUM",
    "EMERALD",
    "DIAMOND",
)
DIVISIONS = ("IV", "III", "II", "I")
APEX = ("MASTER", "GRANDMASTER", "CHALLENGER")
APEX_FLOOR = len(TIERS) * len(DIVISIONS) * 100

def absolute_lp(tier: str | None, division: str | None, lp: int | None) -> int | None:
    if tier is None or lp is None:
        return None
    tier = tier.upper()
    if tier in APEX:
        return APEX_FLOOR + lp
    if tier not in TIERS:
        return None
    division_index = DIVISIONS.index(division.upper()) if division in DIVISIONS else 0
    return (TIERS.index(tier) * len(DIVISIONS) + division_index) * 100 + lp

def get_lp_history(db: Session, puuid: str, queue: str, limit: int) -> list[RankSnapshot]:
    rows = list(
        db.execute(
            select(RankSnapshot)
            .where(RankSnapshot.puuid == puuid, RankSnapshot.queue == queue)
            .order_by(RankSnapshot.captured_at.desc(), RankSnapshot.id.desc())
            .limit(limit)
        ).scalars()
    )
    return list(reversed(rows))

def build_points(rows: list[RankSnapshot]) -> list[dict]:
    points: list[dict] = []
    previous: RankSnapshot | None = None
    for row in rows:
        current = absolute_lp(row.tier, row.division, row.lp)
        lp_delta = None
        games_delta = None
        if previous is not None:
            before = absolute_lp(previous.tier, previous.division, previous.lp)
            if before is not None and current is not None:
                lp_delta = current - before
            if previous.wins is not None and row.wins is not None:
                games_delta = (row.wins - previous.wins) + (
                    (row.losses or 0) - (previous.losses or 0)
                )
        points.append(
            {
                "captured_at": row.captured_at,
                "tier": row.tier,
                "division": row.division,
                "lp": row.lp,
                "wins": row.wins,
                "losses": row.losses,
                "absolute_lp": current,
                "lp_delta": lp_delta,
                "games_delta": games_delta,
            }
        )
        previous = row
    return points

def average_lp_per_win(rows: list[RankSnapshot]) -> float | None:
    gained = 0
    wins = 0
    previous: RankSnapshot | None = None
    for row in rows:
        if previous is not None and previous.wins is not None and row.wins is not None:
            won = row.wins - previous.wins
            before = absolute_lp(previous.tier, previous.division, previous.lp)
            after = absolute_lp(row.tier, row.division, row.lp)
            if won > 0 and before is not None and after is not None and after > before:
                gained += after - before
                wins += won
        previous = row
    if wins == 0:
        return None
    return round(gained / wins, 1)
