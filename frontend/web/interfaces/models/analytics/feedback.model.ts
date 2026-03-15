import { FeedbackType } from "@/interfaces/enums/analytics";

export interface Feedback {
  id: string;
  userId: string;
  messageId: string;
  conversationId: string;
  type: FeedbackType;
  comment?: string;
  questionText: string;
  answerText: string;
  sourcesUsed?: Record<string, any>;
  userDepartmentId: string;
  userRole: string;
  createdAt: Date;
  updatedAt: Date;
}
