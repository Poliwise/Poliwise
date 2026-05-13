from uuid import UUID
from typing import List, Optional
from datetime import datetime
import structlog

from ...db.repositories.conversation_repo import conversation_repository
from ...db.repositories.message_repo import message_repository
from ...models.conversation import ConversationResponse, ConversationCreate

logger = structlog.get_logger()


class ConversationService:
    def __init__(self):
        self.conv_repo = conversation_repository
        self.msg_repo = message_repository

    async def create_conversation(
        self,
        user_id: UUID,
        title: Optional[str] = None
    ) -> ConversationResponse:
        if not title:
            title = "New Conversation"

        return await self.conv_repo.create(user_id, title)

    async def get_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID
    ) -> Optional[ConversationResponse]:
        return await self.conv_repo.get_by_id(conversation_id, user_id)

    async def list_conversations(
        self,
        user_id: UUID,
        page: int = 1,
        size: int = 20,
        keyword: Optional[str] = None
    ) -> tuple[List[ConversationResponse], int]:
        return await self.conv_repo.list_by_user(user_id, page, size, keyword)

    async def delete_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID
    ) -> bool:
        await self.msg_repo.delete_by_conversation(conversation_id, user_id)
        return await self.conv_repo.delete(conversation_id, user_id)

    async def add_message(
        self,
        conversation_id: UUID,
        role: str,
        content: str,
        **kwargs
    ):
        message = await self.msg_repo.create(
            conversation_id=conversation_id,
            role=role,
            content=content,
            **kwargs
        )
        await self.conv_repo.update_message_count(conversation_id)
        return message


conversation_service = ConversationService()