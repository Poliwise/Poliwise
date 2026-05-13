from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime

from ..dependencies import get_user_context, UserContext
from ...services.conversation.manager import conversation_service

router = APIRouter(prefix="/conversations", tags=["Conversations"])


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message_count: int
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PaginatedConversations(BaseModel):
    conversations: List[ConversationResponse]
    page: int
    size: int
    total: int


@router.get("", response_model=PaginatedConversations)
async def list_conversations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    user: UserContext = Depends(get_user_context)
):
    items, total = await conversation_service.list_conversations(
        user.user_id, page, size, keyword
    )
    return PaginatedConversations(
        conversations=items,
        page=page,
        size=size,
        total=total
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    user: UserContext = Depends(get_user_context)
):
    conv = await conversation_service.get_conversation(conversation_id, user.user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    user: UserContext = Depends(get_user_context)
):
    deleted = await conversation_service.delete_conversation(conversation_id, user.user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted"}