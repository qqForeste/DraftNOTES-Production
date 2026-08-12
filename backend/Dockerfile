FROM python:3.13-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

FROM base AS builder
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.lock ./
RUN pip install -r requirements.lock

FROM base AS runtime
RUN useradd --create-home --uid 10001 draftnotes
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY --chown=draftnotes:draftnotes alembic.ini ./
COPY --chown=draftnotes:draftnotes alembic ./alembic
COPY --chown=draftnotes:draftnotes app ./app

USER draftnotes
EXPOSE 8000

# worker overrides this with: arq app.worker.WorkerSettings
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
