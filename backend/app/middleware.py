import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
SILENT_PATHS = frozenset({"/api/health", "/api/health/ready"})

logger = structlog.get_logger("draftnotes.access")

class RequestContextMiddleware(BaseHTTPMiddleware):

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=_elapsed_ms(started),
            )
            raise
        else:
            response.headers[REQUEST_ID_HEADER] = request_id
            if request.url.path not in SILENT_PATHS:
                logger.info(
                    "request",
                    method=request.method,
                    path=request.url.path,
                    status=response.status_code,
                    duration_ms=_elapsed_ms(started),
                )
            return response
        finally:
            structlog.contextvars.unbind_contextvars("request_id")

def _elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)
