import { apiClient } from './api-client';
import { Conversation } from '@/interfaces/models/conversation/conversation.model';
import { Message } from '@/interfaces/models/conversation/message.model';
import { UnansweredQuestion } from '@/interfaces/models/conversation/unanswered-question.model';
import { PaginatedResponse } from './types';

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  context?: {
    documentIds?: string[];
    categoryIds?: string[];
  };
}

export interface SendMessageResponse {
  message: Message;
  conversation: Conversation;
  sources?: {
    documentId: string;
    documentName: string;
    relevanceScore: number;
    excerpt: string;
  }[];
}

export interface ConversationSearchParams {
  page?: number;
  size?: number;
  keyword?: string;
}

class AIService {
  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await apiClient.post<{ success: boolean; data: SendMessageResponse }>('/api/v1/ai/chat', data);
    return response.data;
  }

  async getConversations(params?: ConversationSearchParams): Promise<PaginatedResponse<Conversation>> {
    const response = await apiClient.get<{ success: boolean; data: PaginatedResponse<Conversation> }>(
      '/api/v1/ai/conversations',
      params as Record<string, unknown>
    );
    return response.data;
  }

  async getConversationById(conversationId: string): Promise<Conversation> {
    const response = await apiClient.get<{ success: boolean; data: Conversation }>(
      `/api/v1/ai/conversations/${conversationId}`
    );
    return response.data;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const response = await apiClient.get<{ success: boolean; data: Message[] }>(
      `/api/v1/ai/conversations/${conversationId}/messages`
    );
    return response.data;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/api/v1/ai/conversations/${conversationId}`);
  }

  async clearHistory(conversationId: string): Promise<void> {
    await apiClient.delete(`/api/v1/ai/conversations/${conversationId}/messages`);
  }

  async markAsUnanswered(conversationId: string, messageId: string): Promise<UnansweredQuestion> {
    const response = await apiClient.post<{ success: boolean; data: UnansweredQuestion }>(
      `/api/v1/ai/conversations/${conversationId}/messages/${messageId}/unanswered`
    );
    return response.data;
  }
}

export const aiService = new AIService();
