// AI Question Types

export interface Source {
  documentId: string;
  documentTitle: string;
  chunkId?: string;
  page?: number;
  excerpt: string;
  similarity?: number;
}

export interface SourceDocument {
  documentId: string;
  documentName: string;
  relevanceScore: number;
  excerpt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    documentIds?: string[];
    categoryIds?: string[];
  };
}

export interface ChatResponse {
  answer: string;
  conversationId: string;
  message: Message;
  conversation: Conversation;
  sources?: SourceDocument[];
}

export interface QuestionRequest {
  question: string;
  conversationId?: string;
  department?: string;
}

export interface QuestionResponse {
  answer: string;
  conversationId: string;
  sources: Source[];
  confidence?: number;
  suggestedQuestions?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  page: number;
  size: number;
  total: number;
}

export interface Feedback {
  type: FeedbackType;
  comment?: string;
  createdAt: string;
}

export enum FeedbackType {
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: SourceDocument[];
  modelUsed?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
  tokensTotal?: number;
  latencyMs?: number;
  confidence?: ConfidenceLevel;
  hasSources: boolean;
  isStreaming?: boolean;
  streamingCompleted?: boolean;
  createdAt: string;
}

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  UNKNOWN = 'UNKNOWN',
}

export interface ConversationHistory {
  conversations: Conversation[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Streaming event types
export type StreamEvent =
  | { type: 'conversationId'; conversationId: string }
  | { type: 'sources'; sources: SourceDocument[] }
  | { type: 'content'; content: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

// Unanswered Question
export interface UnansweredQuestion {
  id: string;
  question: string;
  askerId?: string;
  askerName?: string;
  department?: string;
  askCount: number;
  firstAskedAt: string;
  lastAskedAt: string;
  status: UnansweredStatus;
}

export enum UnansweredStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  ANSWERED = 'ANSWERED',
  REJECTED = 'REJECTED',
}
