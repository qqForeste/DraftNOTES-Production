import uuid
from dataclasses import dataclass
from typing import Protocol

from arq.connections import ArqRedis
from arq.jobs import Job, JobStatus

SYNC_JOB = "run_sync"

def cooldown_key(user_id: uuid.UUID) -> str:
    return f"sync:cooldown:{user_id}"

@dataclass
class EnqueuedSync:
    job_id: str
    queue_position: int

@dataclass
class SyncJobState:
    job_id: str
    status: str
    matches_seen: int | None = None
    matches_new: int | None = None
    error: str | None = None

class SyncQueue(Protocol):
    async def claim_slot(self, user_id: uuid.UUID) -> int | None: ...

    async def depth(self) -> int: ...

    async def enqueue(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> EnqueuedSync: ...

    async def state(self, job_id: str) -> SyncJobState: ...

class RedisSyncQueue:

    def __init__(self, pool: ArqRedis, queue_name: str, cooldown_seconds: int) -> None:
        self._pool = pool
        self._queue_name = queue_name
        self._cooldown = cooldown_seconds

    async def claim_slot(self, user_id: uuid.UUID) -> int | None:
        key = cooldown_key(user_id)
        claimed = await self._pool.set(key, "1", ex=self._cooldown, nx=True)
        if claimed:
            return None
        return max(await self._pool.ttl(key), 1)

    async def release_slot(self, user_id: uuid.UUID) -> None:
        await self._pool.delete(cooldown_key(user_id))

    async def depth(self) -> int:
        return await self._pool.zcard(self._queue_name)

    async def enqueue(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> EnqueuedSync:
        job = await self._pool.enqueue_job(
            SYNC_JOB,
            str(user_id),
            platform,
            game_name,
            tag_line,
            _queue_name=self._queue_name,
        )
        if job is None:
            raise RuntimeError("arq refused the job, id already exists")
        return EnqueuedSync(job_id=job.job_id, queue_position=await self.depth())

    async def state(self, job_id: str) -> SyncJobState:
        job = Job(job_id, self._pool, _queue_name=self._queue_name)
        status = await job.status()
        if status is JobStatus.not_found:
            return SyncJobState(job_id=job_id, status="not_found")
        if status is not JobStatus.complete:
            return SyncJobState(job_id=job_id, status=status.value)

        info = await job.result_info()
        if info is None:
            return SyncJobState(job_id=job_id, status="not_found")
        if not info.success:
            failure = info.result
            name = (
                type(failure).__name__
                if isinstance(failure, BaseException)
                else "SyncFailed"
            )
            return SyncJobState(job_id=job_id, status="failed", error=name)
        return SyncJobState(
            job_id=job_id,
            status="complete",
            matches_seen=info.result.get("matches_seen"),
            matches_new=info.result.get("matches_new"),
        )

PINNED_JOB = "run_pinned_sync"

def pinned_cooldown_key(user_id: uuid.UUID, platform: str, game_name: str, tag_line: str) -> str:
    return f"pinned:cooldown:{user_id}:{platform}:{game_name.lower()}#{tag_line.lower()}"

@dataclass
class PinnedJobState:
    job_id: str
    status: str
    pinned_id: int | None = None
    error: str | None = None

class PinnedQueue(Protocol):
    async def claim_slot(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> int | None: ...

    async def depth(self) -> int: ...

    async def enqueue(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> EnqueuedSync: ...

    async def state(self, job_id: str) -> PinnedJobState: ...

class RedisPinnedQueue:

    def __init__(self, pool: ArqRedis, queue_name: str, cooldown_seconds: int) -> None:
        self._pool = pool
        self._queue_name = queue_name
        self._cooldown = cooldown_seconds

    async def claim_slot(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> int | None:
        key = pinned_cooldown_key(user_id, platform, game_name, tag_line)
        claimed = await self._pool.set(key, "1", ex=self._cooldown, nx=True)
        if claimed:
            return None
        return max(await self._pool.ttl(key), 1)

    async def release_slot(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> None:
        await self._pool.delete(pinned_cooldown_key(user_id, platform, game_name, tag_line))

    async def depth(self) -> int:
        return await self._pool.zcard(self._queue_name)

    async def enqueue(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> EnqueuedSync:
        job = await self._pool.enqueue_job(
            PINNED_JOB,
            str(user_id),
            platform,
            game_name,
            tag_line,
            _queue_name=self._queue_name,
        )
        if job is None:
            raise RuntimeError("arq refused the job, id already exists")
        return EnqueuedSync(job_id=job.job_id, queue_position=await self.depth())

    async def state(self, job_id: str) -> PinnedJobState:
        job = Job(job_id, self._pool, _queue_name=self._queue_name)
        status = await job.status()
        if status is JobStatus.not_found:
            return PinnedJobState(job_id=job_id, status="not_found")
        if status is not JobStatus.complete:
            return PinnedJobState(job_id=job_id, status=status.value)

        info = await job.result_info()
        if info is None:
            return PinnedJobState(job_id=job_id, status="not_found")
        if not info.success:
            failure = info.result
            name = (
                type(failure).__name__
                if isinstance(failure, BaseException)
                else "PinnedSyncFailed"
            )
            return PinnedJobState(job_id=job_id, status="failed", error=name)
        return PinnedJobState(
            job_id=job_id, status="complete", pinned_id=info.result.get("pinned_id")
        )

LOOKUP_JOB = "run_lookup_sync"

def lookup_cooldown_key(user_id: uuid.UUID, platform: str, game_name: str, tag_line: str) -> str:
    return f"lookup:cooldown:{user_id}:{platform}:{game_name.lower()}#{tag_line.lower()}"

@dataclass
class LookupJobState:
    job_id: str
    status: str
    puuid: str | None = None
    error: str | None = None

class LookupQueue(Protocol):
    async def claim_slot(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> int | None: ...

    async def depth(self) -> int: ...

    async def enqueue(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> EnqueuedSync: ...

    async def state(self, job_id: str) -> LookupJobState: ...

class RedisLookupQueue:

    def __init__(self, pool: ArqRedis, queue_name: str, cooldown_seconds: int) -> None:
        self._pool = pool
        self._queue_name = queue_name
        self._cooldown = cooldown_seconds

    async def claim_slot(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> int | None:
        key = lookup_cooldown_key(user_id, platform, game_name, tag_line)
        claimed = await self._pool.set(key, "1", ex=self._cooldown, nx=True)
        if claimed:
            return None
        return max(await self._pool.ttl(key), 1)

    async def release_slot(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> None:
        await self._pool.delete(lookup_cooldown_key(user_id, platform, game_name, tag_line))

    async def depth(self) -> int:
        return await self._pool.zcard(self._queue_name)

    async def enqueue(
        self, user_id: uuid.UUID, platform: str, game_name: str, tag_line: str
    ) -> EnqueuedSync:
        job = await self._pool.enqueue_job(
            LOOKUP_JOB,
            str(user_id),
            platform,
            game_name,
            tag_line,
            _queue_name=self._queue_name,
        )
        if job is None:
            raise RuntimeError("arq refused the job, id already exists")
        return EnqueuedSync(job_id=job.job_id, queue_position=await self.depth())

    async def state(self, job_id: str) -> LookupJobState:
        job = Job(job_id, self._pool, _queue_name=self._queue_name)
        status = await job.status()
        if status is JobStatus.not_found:
            return LookupJobState(job_id=job_id, status="not_found")
        if status is not JobStatus.complete:
            return LookupJobState(job_id=job_id, status=status.value)

        info = await job.result_info()
        if info is None:
            return LookupJobState(job_id=job_id, status="not_found")
        if not info.success:
            failure = info.result
            name = (
                type(failure).__name__
                if isinstance(failure, BaseException)
                else "LookupSyncFailed"
            )
            return LookupJobState(job_id=job_id, status="failed", error=name)
        return LookupJobState(
            job_id=job_id, status="complete", puuid=info.result.get("puuid")
        )

RESOLVE_JOB = "run_lookup_resolve"

@dataclass
class ResolveJobState:
    job_id: str
    status: str
    puuid: str | None = None
    error: str | None = None

class ResolveQueue(Protocol):
    async def depth(self) -> int: ...

    async def enqueue(self, platform: str, game_name: str, tag_line: str) -> EnqueuedSync: ...

    async def state(self, job_id: str) -> ResolveJobState: ...

class RedisResolveQueue:

    def __init__(self, pool: ArqRedis, queue_name: str) -> None:
        self._pool = pool
        self._queue_name = queue_name

    async def depth(self) -> int:
        return await self._pool.zcard(self._queue_name)

    async def enqueue(self, platform: str, game_name: str, tag_line: str) -> EnqueuedSync:
        job = await self._pool.enqueue_job(
            RESOLVE_JOB,
            platform,
            game_name,
            tag_line,
            _queue_name=self._queue_name,
        )
        if job is None:
            raise RuntimeError("arq refused the job, id already exists")
        return EnqueuedSync(job_id=job.job_id, queue_position=await self.depth())

    async def state(self, job_id: str) -> ResolveJobState:
        job = Job(job_id, self._pool, _queue_name=self._queue_name)
        status = await job.status()
        if status is JobStatus.not_found:
            return ResolveJobState(job_id=job_id, status="not_found")
        if status is not JobStatus.complete:
            return ResolveJobState(job_id=job_id, status=status.value)

        info = await job.result_info()
        if info is None:
            return ResolveJobState(job_id=job_id, status="not_found")
        if not info.success:
            failure = info.result
            name = (
                type(failure).__name__
                if isinstance(failure, BaseException)
                else "ResolveFailed"
            )
            return ResolveJobState(job_id=job_id, status="failed", error=name)
        return ResolveJobState(
            job_id=job_id, status="complete", puuid=info.result.get("puuid")
        )

OLDER_MATCHES_JOB = "run_older_matches_sync"

def older_matches_cooldown_key(puuid: str) -> str:
    return f"older_matches:cooldown:{puuid}"

@dataclass
class OlderMatchesJobState:
    job_id: str
    status: str
    matches_new: int | None = None
    exhausted: bool | None = None
    error: str | None = None

class OlderMatchesQueue(Protocol):
    async def claim_slot(self, puuid: str) -> int | None: ...

    async def depth(self) -> int: ...

    async def enqueue(self, puuid: str, region: str) -> EnqueuedSync: ...

    async def state(self, job_id: str) -> OlderMatchesJobState: ...

class RedisOlderMatchesQueue:

    def __init__(self, pool: ArqRedis, queue_name: str, cooldown_seconds: int) -> None:
        self._pool = pool
        self._queue_name = queue_name
        self._cooldown = cooldown_seconds

    async def claim_slot(self, puuid: str) -> int | None:
        key = older_matches_cooldown_key(puuid)
        claimed = await self._pool.set(key, "1", ex=self._cooldown, nx=True)
        if claimed:
            return None
        return max(await self._pool.ttl(key), 1)

    async def release_slot(self, puuid: str) -> None:
        await self._pool.delete(older_matches_cooldown_key(puuid))

    async def depth(self) -> int:
        return await self._pool.zcard(self._queue_name)

    async def enqueue(self, puuid: str, region: str) -> EnqueuedSync:
        job = await self._pool.enqueue_job(
            OLDER_MATCHES_JOB,
            puuid,
            region,
            _queue_name=self._queue_name,
        )
        if job is None:
            raise RuntimeError("arq refused the job, id already exists")
        return EnqueuedSync(job_id=job.job_id, queue_position=await self.depth())

    async def state(self, job_id: str) -> OlderMatchesJobState:
        job = Job(job_id, self._pool, _queue_name=self._queue_name)
        status = await job.status()
        if status is JobStatus.not_found:
            return OlderMatchesJobState(job_id=job_id, status="not_found")
        if status is not JobStatus.complete:
            return OlderMatchesJobState(job_id=job_id, status=status.value)

        info = await job.result_info()
        if info is None:
            return OlderMatchesJobState(job_id=job_id, status="not_found")
        if not info.success:
            failure = info.result
            name = (
                type(failure).__name__
                if isinstance(failure, BaseException)
                else "OlderMatchesSyncFailed"
            )
            return OlderMatchesJobState(job_id=job_id, status="failed", error=name)
        return OlderMatchesJobState(
            job_id=job_id,
            status="complete",
            matches_new=info.result.get("matches_new"),
            exhausted=info.result.get("exhausted"),
        )
