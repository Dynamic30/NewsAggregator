from settings import redis_cache, redis_rate_limiter
import json
from functools import wraps
from fastapi import HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from redis.exceptions import RedisError
import hashlib

def cache(expire: int = 600):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Key includes function name + all params (page, limit, filters)
            key_args = {k: v for k, v in kwargs.items() if k not in ("request", "db")}
            raw_key = f"{func.__name__}:{json.dumps(key_args, sort_keys=True, default=str)}"
            key = f"cache:{hashlib.md5(raw_key.encode()).hexdigest()}"

            # Check cache
            try:
                cached = await redis_cache.get(key)
            except RedisError:
                cached = None                    # redis down -> treat as a miss
            if cached:
                return Response(content=cached, media_type="application/json")

            # Miss — run actual function
            result = await func(*args, **kwargs)
            try:
                await redis_cache.setex(key, expire, json.dumps(jsonable_encoder(result)))
            except RedisError:
                pass
            return result
        return wrapper
    return decorator

INCR_WITH_TTL = redis_rate_limiter.register_script("""
local current = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
""")

def rate_limit(max_requests: int = 120, window: int = 60):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, request: Request, **kwargs):
            # When auth is added, just set request.state.user
            user = getattr(request.state, "user", None)
            client_host = request.client.host if request.client else "unknown"
            forwarded = request.headers.get("x-forwarded-for", client_host)
            identifier = user.id if user else forwarded.split(",")[0].strip()

            key = f"rate:{func.__name__}:{identifier}"

            try:
                current = await INCR_WITH_TTL(keys=[key], args=[window])
            except RedisError:
                current = 0

            if current > max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Slow down."
                )

            return await func(*args, request=request, **kwargs)
        return wrapper
    return decorator