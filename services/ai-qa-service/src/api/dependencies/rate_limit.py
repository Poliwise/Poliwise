from fastapi import Request, HTTPException, status
import time
import structlog
from typing import Optional

from ...config.settings import settings
from ...config.redis import redis_client

logger = structlog.get_logger()


async def rate_limit(request: Request):
    """
    Rate limiting dependency for chat endpoints.
    Limits requests based on user_id from headers.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        # If no user ID (should not happen with gateway), we still allow but with shared limit
        user_id = "anonymous"

    # Don't limit ADMIN or MANAGER roles (optional, but common)
    role = request.headers.get("X-Role")
    if role in ["ADMIN", "MANAGER"]:
        return

    client = redis_client.get_client()
    now = time.time()
    key = f"rate_limit:chat:{user_id}"
    window = settings.rate_limit_window_seconds
    limit = settings.rate_limit_requests

    try:
        # Use a sorted set for sliding window rate limiting
        # Remove old requests outside the window
        await client.zremrangebyscore(key, 0, now - window)
        
        # Count requests in current window
        request_count = await client.zcard(key)
        
        if request_count >= limit:
            logger.warning("rate_limit_exceeded", user_id=user_id, count=request_count)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {limit} requests per {window} seconds."
            )
        
        # Add current request
        await client.zadd(key, {str(now): now})
        # Set expiry on the key to clean up inactive users
        await client.expire(key, window)
        
    except HTTPException:
        raise
    except Exception as e:
        # Fail open if Redis is down, but log it
        logger.error("rate_limit_check_failed", error=str(e))
        return
