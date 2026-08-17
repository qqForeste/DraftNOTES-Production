import uuid

from pydantic import BaseModel, Field

class AuthProviders(BaseModel):
    providers: list[str]
    dev_login_enabled: bool
    demo_enabled: bool = False
    guest_enabled: bool = False

class DevLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+$")

class LinkedSummoner(BaseModel):
    puuid: str
    game_name: str
    tag_line: str
    platform: str | None
    is_primary: bool
    verified: bool

class MeOut(BaseModel):
    id: uuid.UUID
    email: str | None
    display_name: str | None
    provider: str
    summoners: list[LinkedSummoner]
