import { MessageRole, ConfidenceLevel } from "@/interfaces/enums/conversation";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  sources?: Record<string, any>;
  modelUsed?: string;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  latencyMs: number;
  confidence?: ConfidenceLevel;
  hasSources: boolean;
  isStreaming: boolean;
  streamingCompleted: boolean;
  createdAt: Date;
}
