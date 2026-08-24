
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import Match, Participant
from app.riot import fixtures
from app.services.sync import _parse_match

def main() -> None:
    settings = get_settings()
    db = SessionLocal()
    updated = 0
    skipped = 0
    try:
        match_ids = db.execute(select(Match.match_id)).scalars().all()
        for match_id in match_ids:
            try:
                match_json = fixtures.load(settings.fixtures_dir, f"matches/{match_id}.json")
            except fixtures.FixtureMissingError:
                skipped += 1
                print(f"skip {match_id}: no cached fixture on disk")
                continue

            match = db.get(Match, match_id)
            for participant in db.execute(
                select(Participant).where(Participant.match_id == match_id)
            ).scalars():
                parsed_match, parsed = _parse_match(match_json, participant.puuid)
                participant.items = parsed.items
                participant.summoner_1_id = parsed.summoner_1_id
                participant.summoner_2_id = parsed.summoner_2_id
                participant.primary_rune_id = parsed.primary_rune_id
                participant.secondary_style_id = parsed.secondary_style_id
                participant.champion_level = parsed.champion_level
                participant.double_kills = parsed.double_kills
                participant.triple_kills = parsed.triple_kills
                participant.quadra_kills = parsed.quadra_kills
                participant.penta_kills = parsed.penta_kills
                participant.wards_placed = parsed.wards_placed
                participant.control_wards_purchased = parsed.control_wards_purchased
                participant.kill_participation_pct = parsed.kill_participation_pct
                participant.profile_icon_id = parsed.profile_icon_id
                match.scoreboard = parsed_match.scoreboard

            updated += 1

        db.commit()
    finally:
        db.close()

    print(f"backfilled {updated} match(es), skipped {skipped} (fixture missing)")

if __name__ == "__main__":
    main()
