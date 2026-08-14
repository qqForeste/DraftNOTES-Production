
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Summoner
from app.riot.client import RiotClient
from app.services.pinned import sync_summoner_data

async def sync_looked_up_summoner(
    db: Session,
    riot_client: RiotClient,
    platform: str,
    game_name: str,
    tag_line: str,
) -> Summoner:
    settings = get_settings()
    return await sync_summoner_data(
        db, riot_client, platform, game_name, tag_line, settings.sync_match_count
    )
