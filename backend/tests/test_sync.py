import glob
import json

from sqlalchemy import select

from app.models import AppUser, Match, Participant, RankSnapshot, Summoner
from app.services.ranks import CallBudget, platform_from_match_id, resolve_ranks
from app.services.sync import (
    _build_scoreboard,
    _parse_match,
    _participant_from_scoreboard,
    record_rank_snapshots,
    sync_summoner,
)

PLATFORM = "euw1"
REGION = "europe"

def _fixture_match() -> dict:
    path = sorted(glob.glob("fixtures/matches/*.json"))[0]
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)

class FakeRiot:

    def __init__(self, match_json: dict, puuid: str, match_ids: list[str], ranks=None):
        self.match_json = match_json
        self.puuid = puuid
        self.match_ids = match_ids
        self.ranks = ranks or []
        self.calls = {"account": 0, "league": 0, "ids": 0, "match": 0}

    async def get_account_by_riot_id(self, region, game_name, tag_line):
        self.calls["account"] += 1
        return {"puuid": self.puuid, "gameName": game_name, "tagLine": tag_line}

    async def get_league_entries_by_puuid(self, platform, puuid):
        self.calls["league"] += 1
        return self.ranks

    async def get_ranked_match_ids(self, region, puuid, count=20):
        self.calls["ids"] += 1
        return self.match_ids

    async def get_match(self, region, match_id):
        self.calls["match"] += 1
        return self.match_json

def _user(db, email: str) -> AppUser:
    user = AppUser(provider="dev", oauth_sub=email, email=email)
    db.add(user)
    db.commit()
    return user

def test_scoreboard_carries_every_player():
    data = _fixture_match()
    me = data["info"]["participants"][3]["puuid"]
    match, participant = _parse_match(data, me)

    assert len(match.scoreboard) == 10
    assert match.winning_team_id in (100, 200)
    assert sum(e["is_self"] for e in match.scoreboard) == 1

    entry = next(e for e in match.scoreboard if e["is_self"])
    assert entry["kills"] == participant.kills
    assert entry["damage_dealt"] > 0
    assert len(entry["items"]) == 7
    assert entry["tag_line"]
    assert entry["tier"] is None, "ranks are filled in later, not by the parser"

def test_role_quest_item_comes_from_role_bound_item():
    data = _fixture_match()
    scoreboard = _build_scoreboard(data["info"]["participants"], data["info"]["participants"][0]["puuid"])

    by_position = {e["team_position"]: e["role_quest_item_id"] for e in scoreboard}
    assert by_position["MIDDLE"] == 1206
    assert by_position["JUNGLE"] in (1204, 1209)
    assert by_position["TOP"] in (1220, 1221)
    assert by_position["UTILITY"] in (2055, 1208)
    assert by_position["BOTTOM"] not in (1206, 1207, 1208, 1209, 1220, 1221)

    for entry in scoreboard:
        assert entry["role_quest_item_id"] not in entry["items"]

def test_internal_puuid_is_stored_but_never_serialised():
    from app.schemas.match import ScoreboardEntry

    data = _fixture_match()
    scoreboard = _build_scoreboard(data["info"]["participants"], "nobody")
    assert all(e["puuid"] for e in scoreboard)
    assert "puuid" not in ScoreboardEntry(**scoreboard[0]).model_dump()

async def test_second_user_on_a_shared_match_gets_a_participant_row(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid_a = data["info"]["participants"][3]["puuid"]
    puuid_b = data["info"]["participants"][7]["puuid"]

    user_a, user_b = _user(db, "a@example.com"), _user(db, "b@example.com")

    riot_a = FakeRiot(data, puuid_a, [match_id])
    await sync_summoner(db, riot_a, user_a, PLATFORM, "A", "EUW")

    riot_b = FakeRiot(data, puuid_b, [match_id])
    result = await sync_summoner(db, riot_b, user_b, PLATFORM, "B", "EUW")

    assert db.get(Participant, (match_id, puuid_b)) is not None
    assert result["matches_new"] == 1
    assert db.execute(select(Match)).scalars().all().__len__() == 1, "match rows stay shared"
    assert riot_b.calls["match"] == 0, "rebuilt from the stored scoreboard, no refetch"

async def test_resyncing_does_not_duplicate_or_refetch(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][3]["puuid"]
    user = _user(db, "again@example.com")

    riot = FakeRiot(data, puuid, [match_id])
    await sync_summoner(db, riot, user, PLATFORM, "A", "EUW")
    second = await sync_summoner(db, riot, user, PLATFORM, "A", "EUW")

    assert second["matches_new"] == 0
    assert riot.calls["match"] == 1
    assert len(db.execute(select(Participant)).scalars().all()) == 1

async def test_own_legacy_scoreboard_is_widened_on_resync(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][3]["puuid"]
    user = _user(db, "legacy@example.com")

    riot = FakeRiot(data, puuid, [match_id])
    await sync_summoner(db, riot, user, PLATFORM, "A", "EUW")

    match = db.get(Match, match_id)
    match.winning_team_id = None
    match.scoreboard = [
        {
            "game_name": e["game_name"],
            "champion_id": e["champion_id"],
            "team_id": e["team_id"],
            "is_self": e["is_self"],
        }
        for e in match.scoreboard
    ]
    db.commit()

    result = await sync_summoner(db, riot, user, PLATFORM, "A", "EUW")

    assert result["matches_new"] == 0, "not a new game, just re-enriched"
    assert riot.calls["match"] == 2, "refetched once more to widen the stale row"

    widened = db.get(Match, match_id)
    assert widened.winning_team_id is not None
    assert "kills" in widened.scoreboard[0]

    participant = db.get(Participant, (match_id, puuid))
    assert participant.kills == data["info"]["participants"][3]["kills"]

async def test_legacy_match_survives_scrolling_off_the_recent_window(db):
    data = _fixture_match()
    match_id = data["metadata"]["matchId"]
    puuid = data["info"]["participants"][3]["puuid"]
    user = _user(db, "scrolled-off@example.com")

    riot = FakeRiot(data, puuid, [match_id])
    await sync_summoner(db, riot, user, PLATFORM, "A", "EUW")

    match = db.get(Match, match_id)
    match.winning_team_id = None
    match.scoreboard = [
        {
            "game_name": e["game_name"],
            "champion_id": e["champion_id"],
            "team_id": e["team_id"],
            "is_self": e["is_self"],
        }
        for e in match.scoreboard
    ]
    db.commit()

    riot_later = FakeRiot(data, puuid, [])
    result = await sync_summoner(db, riot_later, user, PLATFORM, "A", "EUW")

    assert result["matches_new"] == 0
    assert riot_later.calls["match"] == 1, "widened even though it's outside match_ids"

    widened = db.get(Match, match_id)
    assert widened.winning_team_id is not None
    assert "kills" in widened.scoreboard[0]

def test_rebuild_derives_win_from_the_winning_team():
    data = _fixture_match()
    me = data["info"]["participants"][3]["puuid"]
    match, participant = _parse_match(data, me)

    rebuilt = _participant_from_scoreboard(match, me)
    assert rebuilt.win == participant.win
    assert rebuilt.kills == participant.kills
    assert rebuilt.kill_participation_pct == participant.kill_participation_pct
    assert rebuilt.role_quest_item_id == participant.role_quest_item_id

    loser = next(e for e in match.scoreboard if e["team_id"] != match.winning_team_id)
    assert _participant_from_scoreboard(match, loser["puuid"]).win is False

def test_rebuild_declines_a_legacy_scoreboard():
    match = Match(
        match_id="EUW1_1",
        game_creation=None,
        game_duration=1,
        queue_id=420,
        patch="16.1",
        winning_team_id=100,
        scoreboard=[{"game_name": "x", "champion_id": 1, "team_id": 100, "is_self": True}],
    )
    assert _participant_from_scoreboard(match, "whoever") is None

def test_platform_from_match_id():
    assert platform_from_match_id("KR_8351445185") == "kr"
    assert platform_from_match_id("EUW1_7874771722") == "euw1"
    assert platform_from_match_id("NOPE_1") is None
    assert platform_from_match_id("garbage") is None

def _entries(tier="GOLD", division="IV"):
    return [
        {
            "queueType": "RANKED_SOLO_5x5",
            "tier": tier,
            "rank": division,
            "leaguePoints": 42,
            "wins": 10,
            "losses": 8,
        }
    ]

class RankRiot:
    def __init__(self, entries=None, fail=False):
        self.entries = entries if entries is not None else _entries()
        self.fail = fail
        self.calls = 0

    async def get_league_entries_by_puuid(self, platform, puuid):
        self.calls += 1
        if self.fail:
            from app.riot.client import RiotApiError

            raise RiotApiError(503, "service unavailable")
        return self.entries

async def test_rank_lookup_populates_and_then_caches(db):
    riot = RankRiot()
    entries = [{"puuid": "p1", "game_name": "Opponent", "tag_line": "EUW"}]
    budget = CallBudget(10)

    ranks = await resolve_ranks(db, riot, entries, PLATFORM, 24, budget)
    assert ranks["p1"] == ("GOLD", "IV")
    assert riot.calls == 1

    ranks = await resolve_ranks(db, riot, entries, PLATFORM, 24, CallBudget(10))
    assert ranks["p1"] == ("GOLD", "IV")
    assert riot.calls == 1, "a fresh row must not be refetched"

async def test_unranked_is_a_cached_answer(db):
    riot = RankRiot(entries=[])
    entries = [{"puuid": "p2", "game_name": "Smurf", "tag_line": "EUW"}]

    assert await resolve_ranks(db, riot, entries, PLATFORM, 24, CallBudget(5)) == {"p2": (None, None)}
    await resolve_ranks(db, riot, entries, PLATFORM, 24, CallBudget(5))
    assert riot.calls == 1, "known-unranked must not be looked up forever"

async def test_budget_exhaustion_degrades_to_no_rank(db):
    riot = RankRiot()
    entries = [{"puuid": f"p{i}", "game_name": "X", "tag_line": "EUW"} for i in range(5)]

    ranks = await resolve_ranks(db, riot, entries, PLATFORM, 24, CallBudget(2))
    assert riot.calls == 2
    assert sum(1 for r in ranks.values() if r == (None, None)) == 3

async def test_a_riot_error_does_not_fail_the_sync(db):
    riot = RankRiot(fail=True)
    entries = [{"puuid": "p9", "game_name": "X", "tag_line": "EUW"}]
    assert await resolve_ranks(db, riot, entries, PLATFORM, 24, CallBudget(5)) == {"p9": (None, None)}

def _summoner(db, **over) -> Summoner:
    fields = dict(
        puuid="lp-puuid",
        game_name="Faker",
        tag_line="KR1",
        region="asia",
        solo_tier="GOLD",
        solo_division="IV",
        solo_lp=40,
        solo_wins=10,
        solo_losses=9,
    )
    fields.update(over)
    summoner = Summoner(**fields)
    db.add(summoner)
    db.commit()
    return summoner

def _snapshots(db, queue="solo"):
    return list(
        db.execute(
            select(RankSnapshot)
            .where(RankSnapshot.queue == queue)
            .order_by(RankSnapshot.id)
        ).scalars()
    )

def test_snapshot_survives_a_brand_new_unflushed_summoner(db):
    summoner = Summoner(
        puuid="brand-new-puuid",
        game_name="New",
        tag_line="NA1",
        region="americas",
        solo_tier="GOLD",
        solo_division="II",
        solo_lp=50,
        solo_wins=10,
        solo_losses=8,
    )
    db.add(summoner)
    record_rank_snapshots(db, summoner)
    db.commit()
    assert len(_snapshots(db)) == 1

def test_snapshot_is_written_once_per_change(db):
    summoner = _summoner(db)
    record_rank_snapshots(db, summoner)
    db.commit()
    assert len(_snapshots(db)) == 1

    record_rank_snapshots(db, summoner)
    db.commit()
    assert len(_snapshots(db)) == 1, "an unchanged rank must not add a point"

    summoner.solo_lp = 61
    summoner.solo_wins = 11
    record_rank_snapshots(db, summoner)
    db.commit()
    points = _snapshots(db)
    assert len(points) == 2
    assert points[-1].lp == 61 and points[-1].wins == 11

def test_unranked_queue_records_nothing(db):
    summoner = _summoner(db, solo_tier=None, solo_division=None, solo_lp=None, solo_wins=None, solo_losses=None)
    record_rank_snapshots(db, summoner)
    db.commit()
    assert _snapshots(db) == []

def test_absolute_lp_is_monotonic_across_promotions():
    from app.services.lp_history import absolute_lp

    ladder = [
        ("IRON", "IV", 0),
        ("GOLD", "IV", 40),
        ("GOLD", "III", 5),
        ("DIAMOND", "I", 99),
        ("MASTER", None, 0),
        ("CHALLENGER", "I", 1844),
    ]
    values = [absolute_lp(*rung) for rung in ladder]
    assert values == sorted(values), values
    assert absolute_lp(None, None, None) is None

def test_lp_history_reports_real_deltas(db):
    from app.services.lp_history import average_lp_per_win, build_points, get_lp_history

    summoner = _summoner(db)
    record_rank_snapshots(db, summoner)
    db.commit()

    summoner.solo_lp = 62
    summoner.solo_wins = 11
    record_rank_snapshots(db, summoner)
    db.commit()

    rows = get_lp_history(db, summoner.puuid, "solo", 100)
    points = build_points(rows)
    assert len(points) == 2
    assert points[0]["lp_delta"] is None, "no delta on the first point"
    assert points[1]["lp_delta"] == 22
    assert points[1]["games_delta"] == 1
    assert average_lp_per_win(rows) == 22.0

def test_average_lp_per_win_needs_two_points(db):
    from app.services.lp_history import average_lp_per_win, get_lp_history

    summoner = _summoner(db)
    record_rank_snapshots(db, summoner)
    db.commit()
    assert average_lp_per_win(get_lp_history(db, summoner.puuid, "solo", 100)) is None
