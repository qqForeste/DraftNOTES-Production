import asyncio
import time
from collections import defaultdict, deque

class _Bucket:
    def __init__(self) -> None:
        self._limits: dict[int, int] = {}
        self._hits: dict[int, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    def learn(self, header_value: str | None) -> None:
        if not header_value:
            return
        limits: dict[int, int] = {}
        for pair in header_value.split(","):
            count_str, window_str = pair.split(":")
            limits[int(window_str)] = int(count_str)
        self._limits = limits
        for window in list(self._hits):
            if window not in limits:
                del self._hits[window]

    async def wait_for_slot(self) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                sleep_for = 0.0
                for window, limit in self._limits.items():
                    dq = self._hits[window]
                    while dq and now - dq[0] >= window:
                        dq.popleft()
                    if len(dq) >= limit:
                        sleep_for = max(sleep_for, window - (now - dq[0]))
                if sleep_for <= 0:
                    break
                await asyncio.sleep(sleep_for)
            now = time.monotonic()
            for window in self._limits:
                self._hits[window].append(now)

    async def cool_down(self, seconds: float) -> None:
        async with self._lock:
            now = time.monotonic()
            for window, limit in self._limits.items():
                dq = self._hits[window]
                dq.clear()
                dq.extend([now] * limit)
                oldest_allowed = now - window + seconds
                self._hits[window] = deque([oldest_allowed] * limit)

class RiotRateLimiter:

    def __init__(self) -> None:
        self._app_buckets: dict[str, _Bucket] = defaultdict(_Bucket)
        self._method_buckets: dict[tuple[str, str], _Bucket] = defaultdict(_Bucket)

    async def wait_for_slot(self, host: str, method: str) -> None:
        await self._app_buckets[host].wait_for_slot()
        await self._method_buckets[(host, method)].wait_for_slot()

    def learn_from_headers(self, host: str, method: str, headers) -> None:
        self._app_buckets[host].learn(headers.get("X-App-Rate-Limit"))
        self._method_buckets[(host, method)].learn(headers.get("X-Method-Rate-Limit"))

    async def cool_down(self, host: str, method: str, rate_limit_type: str | None, seconds: float) -> None:
        if rate_limit_type in (None, "service"):
            await self._app_buckets[host].cool_down(seconds)
            await self._method_buckets[(host, method)].cool_down(seconds)
        elif rate_limit_type == "application":
            await self._app_buckets[host].cool_down(seconds)
        elif rate_limit_type == "method":
            await self._method_buckets[(host, method)].cool_down(seconds)
