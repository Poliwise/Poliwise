// AI Question Types
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

export interface Source {
  documentId: string;
  documentTitle: string;
  chunkId?: string;
  page?: number;
  excerpt: string;
  similarity?: number;
}

export interface Conversation {
  id: string;
  userId: string;
  question: string;
  answer: string;
  sources: Source[];
  feedback?: Feedback;
  createdAt: string;
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
  sources?: Source[];
  createdAt: string;
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
