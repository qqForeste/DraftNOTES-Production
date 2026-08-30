import asyncio
import time

import pytest

from app.riot.rate_limiter import RiotRateLimiter, _Bucket

async def test_first_request_is_never_blocked_before_limits_are_known():
    bucket = _Bucket()
    start = time.monotonic()
    await bucket.wait_for_slot()
    assert time.monotonic() - start < 0.05

async def test_bucket_blocks_once_learned_limit_is_hit():
    bucket = _Bucket()
    bucket.learn("2:1")

    await bucket.wait_for_slot()
    await bucket.wait_for_slot()

    start = time.monotonic()
    await bucket.wait_for_slot()
    elapsed = time.monotonic() - start

    assert elapsed >= 0.9

async def test_app_and_method_buckets_are_independent_per_host_and_method():
    limiter = RiotRateLimiter()
    limiter._app_buckets["americas.api.riotgames.com"].learn("100:1")
    limiter._method_buckets[("americas.api.riotgames.com", "get-match")].learn("1:1")

    start = time.monotonic()
    await limiter.wait_for_slot("americas.api.riotgames.com", "get-match")
    await limiter.wait_for_slot("americas.api.riotgames.com", "get-match")
    elapsed = time.monotonic() - start

    assert elapsed >= 0.9

    start = time.monotonic()
    await limiter.wait_for_slot("americas.api.riotgames.com", "get-account")
    assert time.monotonic() - start < 0.05

async def test_cool_down_forces_a_wait_even_without_prior_hits():
    bucket = _Bucket()
    bucket.learn("20:1")

    await bucket.cool_down(0.3)

    start = time.monotonic()
    await bucket.wait_for_slot()
    assert time.monotonic() - start >= 0.25
