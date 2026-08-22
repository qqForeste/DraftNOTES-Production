import base64
import binascii
from datetime import datetime

from fastapi import HTTPException

def encode_cursor(game_creation: datetime, match_id: str) -> str:
    raw = f"{game_creation.isoformat()}|{match_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")

def decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        created_at, match_id = raw.split("|", 1)
        return datetime.fromisoformat(created_at), match_id
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid pagination cursor") from None
