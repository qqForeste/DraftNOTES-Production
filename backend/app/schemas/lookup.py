from pydantic import BaseModel, Field

class LookupSyncRequest(BaseModel):
    game_name: str = Field(min_length=1, max_length=64)
    tag_line: str = Field(min_length=1, max_length=16)
    platform: str

class LookupSyncEnqueued(BaseModel):
    job_id: str
    status: str
    queue_position: int

class LookupSyncJob(BaseModel):
    job_id: str
    status: str
    puuid: str | None = None
    error: str | None = None

class LookupResolveEnqueued(BaseModel):
    job_id: str
    status: str
    queue_position: int

class LookupResolveJob(BaseModel):
    job_id: str
    status: str
    puuid: str | None = None
    error: str | None = None
