from fastapi import Request, HTTPException, status
from pydantic import BaseModel
from uuid import UUID
from typing import Optional

from ...config.settings import settings


class UserContext(BaseModel):
    user_id: UUID
    role: str
    department_id: Optional[UUID] = None

    class Config:
        from_attributes = True


def get_user_context(request: Request) -> UserContext:
    user_id = request.headers.get("X-User-Id")
    role = request.headers.get("X-Role")
    department_id = request.headers.get("X-Department-Id")

    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user context headers (request must pass through API Gateway)"
        )

    return UserContext(
        user_id=UUID(user_id),
        role=role,
        department_id=UUID(department_id) if department_id else None
    )


def verify_internal_api_key(request: Request) -> bool:
    api_key = request.headers.get("X-Internal-Api-Key")
    if api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key"
        )
    return True
