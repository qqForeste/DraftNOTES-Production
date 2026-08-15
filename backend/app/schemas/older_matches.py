from pydantic import BaseModel

class OlderMatchesEnqueued(BaseModel):
    job_id: str
    status: str
    queue_position: int

class OlderMatchesJob(BaseModel):
    job_id: str
    status: str
    matches_new: int | None = None
    exhausted: bool | None = None
    error: str | None = None
