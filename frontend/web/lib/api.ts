/**
 * Poliwise API Client
 * Centralized API client for all backend services.
 *
 * Convention:
 * - All authenticated requests automatically include Bearer token from localStorage.
 * - 401 responses trigger automatic token refresh + retry.
 * - Multipart uploads (document upload) bypass gateway for streaming reasons.
 * - All responses follow ApiResponse<T> wrapper format.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  // Shared types
  ApiResponse,
  ApiError,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  User,
  Session,
  Document,
  DocumentSearchParams,
  DocumentUploadResponse,
  QuestionRequest,
  QuestionResponse,
  Conversation,
  Message,
  ConversationHistory,
  UnansweredQuestion,
  DashboardStats,
  AnalyticsOverview,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/** Direct knowledge-service URL for multipart uploads (bypass gateway streaming issues) */
const KNOWLEDGE_SERVICE_URL =
  typeof window === 'undefined'
    ? 'http://knowledge-service:8083'
    : 'http://localhost:8083';

// ============================================================================
// Response coercers — handle both wrapped { success: true, data: {...} and raw responses
// ============================================================================

type RawTokenBody = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresInSeconds?: number;
  user?: LoginResponse['user'];
};

function coerceLoginResponse(body: unknown): LoginResponse {
  const root = body as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') throw new Error('Phản hồi đăng nhập không hợp lệ');

  const data = 'data' in root && root.data && typeof root.data === 'object'
    ? root.data as RawTokenBody
    : root as RawTokenBody;

  const expiresIn = typeof data.expiresIn === 'number'
    ? data.expiresIn
    : typeof data.expiresInSeconds === 'number'
      ? data.expiresInSeconds
      : 0;

  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new Error('Phản hồi đăng nhập không hợp lệ');
  }

  return { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn, user: data.user };
}

function coerceRefreshResponse(body: unknown): RefreshTokenResponse {
  const root = body as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') throw new Error('Phản hồi làm mới token không hợp lệ');

  const data = 'data' in root && root.data && typeof root.data === 'object'
    ? root.data as RawTokenBody
    : root as RawTokenBody;

  const expiresIn = typeof data.expiresIn === 'number'
    ? data.expiresIn
    : typeof data.expiresInSeconds === 'number'
      ? data.expiresInSeconds
      : 0;

  if (!data.accessToken || !data.refreshToken) throw new Error('Phản hồi làm mới token không hợp lệ');

  return { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn };
}

function coercePaginated<T>(
  response: unknown,
  dataKey: keyof Record<string, unknown>
): { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  const root = response as Record<string, unknown> | null;
  if (!root) return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };

  const dataArr = (dataKey in root ? root[dataKey] : root) as T[] | undefined;
  const pagination = (root.pagination || root.Pagination) as
    | { page: number; limit: number; total: number; totalPages: number }
    | undefined;

  return {
    data: Array.isArray(dataArr) ? dataArr : [],
    pagination: pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
  };
}

// ============================================================================
// API Client
// ============================================================================

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // — Request: inject Bearer token + trace ID
    this.client.interceptors.request.use((config) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const traceId = typeof window !== 'undefined' ? localStorage.getItem('traceId') : null;
      if (traceId) config.headers['X-Trace-ID'] = traceId;
      return config;
    });

    // — Response: handle 401 → token refresh → retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const original = error.config;
        if (error.response?.status === 401 && original) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const tokens = await this.auth.refresh(refreshToken);
              localStorage.setItem('accessToken', tokens.accessToken);
              localStorage.setItem('refreshToken', tokens.refreshToken);
              original.headers.Authorization = `Bearer ${tokens.accessToken}`;
              return this.client(original);
            } catch {
              await this.auth.logout();
              if (typeof window !== 'undefined') window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ==========================================================================
  // Auth
  // ==========================================================================
  auth = {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
      const res = await this.client.post<unknown>('/api/v1/auth/login', data);
      return coerceLoginResponse(res.data);
    },

    register: async (data: {
      username: string;
      email: string;
      password: string;
      role?: string;
      departmentId?: string;
    }): Promise<void> => {
      await this.client.post('/api/v1/auth/register', data);
    },

    refresh: async (refreshToken: string): Promise<RefreshTokenResponse> => {
      const res = await this.client.post<unknown>(
        '/api/v1/auth/refresh',
        { refreshToken },
        { headers: { 'X-User-Id': localStorage.getItem('userId') || '' } }
      );
      return coerceRefreshResponse(res.data);
    },

    logout: async (refreshToken?: string): Promise<void> => {
      const token = refreshToken || localStorage.getItem('refreshToken');
      if (token) {
        try {
          await this.client.post('/api/v1/auth/logout', { refreshToken: token });
        } catch { /* ignore */ }
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
    },

    logoutAll: async (): Promise<void> => {
      await this.client.post('/api/v1/auth/logout-all');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
    },

    getSessions: async (): Promise<Session[]> => {
      const res = await this.client.get<ApiResponse<Session[]>>('/api/v1/auth/sessions');
      return coercePaginated<Session>(res.data, 'data').data;
    },

    revokeSession: async (refreshToken: string): Promise<void> => {
      await this.client.post('/api/v1/auth/logout', { refreshToken });
    },
  };

  // ==========================================================================
  // Users
  // ==========================================================================
  users = {
    getMe: async (): Promise<User> => {
      const res = await this.client.get<ApiResponse<User>>('/api/v1/users/me');
      return coercePaginated<User>(res.data, 'data').data[0] ?? res.data.data!;
    },

    getById: async (userId: string): Promise<User> => {
      const res = await this.client.get<ApiResponse<User>>(`/api/v1/users/${userId}`);
      return coercePaginated<User>(res.data, 'data').data[0] ?? res.data.data!;
    },

    updateMe: async (data: Partial<User>): Promise<User> => {
      const res = await this.client.put<ApiResponse<User>>('/api/v1/users/me', data);
      return coercePaginated<User>(res.data, 'data').data[0] ?? res.data.data!;
    },

    updateDepartment: async (departmentId: string): Promise<void> => {
      await this.client.patch('/api/v1/users/me/department', { departmentId });
    },

    search: async (params?: {
      page?: number;
      limit?: number;
      search?: string;
      role?: string;
      status?: string;
      departmentId?: string;
    }): Promise<{ data: User[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
      const res = await this.client.get<
        ApiResponse<User[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/users', { params });
      const coerced = coercePaginated<User>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as { data?: User[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    updateStatus: async (userId: string, status: string): Promise<void> => {
      await this.client.patch(`/api/v1/users/${userId}/status`, { status });
    },

    delete: async (userId: string): Promise<void> => {
      await this.client.delete(`/api/v1/users/${userId}`);
    },
  };

  // ==========================================================================
  // Documents
  // ==========================================================================
  documents = {
    getAll: async (params?: DocumentSearchParams): Promise<{
      data: Document[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const res = await this.client.get<
        ApiResponse<Document[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/documents', { params });
      const coerced = coercePaginated<Document>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as { data?: Document[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    getById: async (id: string): Promise<Document> => {
      const res = await this.client.get<ApiResponse<Document>>(`/api/v1/documents/${id}`);
      return coercePaginated<Document>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    upload: async (
      file: File,
      changelog?: string,
      language?: string
    ): Promise<DocumentUploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      if (changelog) formData.append('changelog', changelog);
      if (language) formData.append('language', language);
      const res = await this.client.post<unknown>(
        `${KNOWLEDGE_SERVICE_URL}/api/v1/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data as DocumentUploadResponse;
    },

    delete: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/documents/${id}`);
    },

    download: async (id: string): Promise<Blob> => {
      const res = await this.client.get(`/api/v1/documents/${id}/download`, {
        responseType: 'blob',
      });
      return res.data;
    },

    confirmMetadata: async (
      documentId: string,
      data: {
        title: string;
        description: string;
        categorySlug: string;
        tags: string[];
        language: string;
        isPolicy: boolean;
      }
    ): Promise<DocumentUploadResponse> => {
      const res = await this.client.post<unknown>(
        `${KNOWLEDGE_SERVICE_URL}/api/v1/documents/${documentId}/confirm`,
        data
      );
      return res.data as DocumentUploadResponse;
    },

    cancel: async (documentId: string): Promise<void> => {
      await this.client.delete(`${KNOWLEDGE_SERVICE_URL}/api/v1/documents/${documentId}/cancel`);
    },

    getVersions: async (documentId: string): Promise<Document[]> => {
      const res = await this.client.get<ApiResponse<Document[]>>(
        `/api/v1/documents/${documentId}/versions`
      );
      return coercePaginated<Document>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    triggerProcess: async (documentId: string): Promise<void> => {
      await this.client.post(`/api/v1/documents/${documentId}/process`);
    },

    comparePolicies: async (doc1Id: string, doc2Id: string): Promise<{
      document1: Document;
      document2: Document;
      added: string[];
      removed: string[];
      modified: { old: string; new: string }[];
    }> => {
      const res = await this.client.get<{
        data?: {
          document1: Document;
          document2: Document;
          added: string[];
          removed: string[];
          modified: { old: string; new: string }[];
        };
      }>(`/api/v1/documents/compare?doc1=${doc1Id}&doc2=${doc2Id}`);
      return res.data!.data!;
    },
  };

  // ==========================================================================
  // AI / Conversation
  // ==========================================================================
  ai = {
    ask: async (data: QuestionRequest): Promise<QuestionResponse> => {
      const res = await this.client.post<ApiResponse<QuestionResponse>>('/api/v1/ai/ask', data);
      return coercePaginated<QuestionResponse>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    getConversations: async (params?: {
      page?: number;
      limit?: number;
      keyword?: string;
    }): Promise<ConversationHistory> => {
      const res = await this.client.get<
        ApiResponse<Conversation[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/ai/conversations', { params });
      const coerced = coercePaginated<Conversation>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        conversations: coerced.data.length ? coerced.data : (res.data as unknown as { data?: Conversation[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    getConversationById: async (id: string): Promise<Conversation> => {
      const res = await this.client.get<ApiResponse<Conversation>>(`/api/v1/ai/conversations/${id}`);
      return coercePaginated<Conversation>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    getMessages: async (conversationId: string): Promise<Message[]> => {
      const res = await this.client.get<ApiResponse<Message[]>>(
        `/api/v1/ai/conversations/${conversationId}/messages`
      );
      return coercePaginated<Message>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    deleteConversation: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/ai/conversations/${id}`);
    },

    clearHistory: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/ai/conversations/${id}/messages`);
    },

    markAsUnanswered: async (conversationId: string, messageId: string): Promise<UnansweredQuestion> => {
      const res = await this.client.post<ApiResponse<UnansweredQuestion>>(
        `/api/v1/ai/conversations/${conversationId}/messages/${messageId}/unanswered`
      );
      return coercePaginated<UnansweredQuestion>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },
  };

  // ==========================================================================
  // Feedback
  // ==========================================================================
  feedback = {
    submit: async (
      conversationId: string,
      messageId: string,
      type: 'LIKE' | 'DISLIKE',
      comment?: string
    ): Promise<void> => {
      await this.client.post('/api/v1/feedback', {
        conversationId,
        messageId, // ✅ FIX: was missing in original implementation
        type,
        comment,
      });
    },

    getByConversation: async (conversationId: string): Promise<unknown[]> => {
      const res = await this.client.get<ApiResponse<unknown[]>>(
        `/api/v1/feedback?conversationId=${conversationId}`
      );
      return coercePaginated<unknown>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    getMyFeedbacks: async (params?: {
      page?: number;
      limit?: number;
    }): Promise<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
      const res = await this.client.get<
        ApiResponse<unknown[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/feedback', { params });
      const coerced = coercePaginated<unknown>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as { data?: unknown[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    delete: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/feedback/${id}`);
    },
  };

  // ==========================================================================
  // Analytics
  // ==========================================================================
  analytics = {
    getDashboard: async (): Promise<DashboardStats> => {
      const res = await this.client.get<ApiResponse<DashboardStats>>('/api/v1/analytics/dashboard');
      return coercePaginated<DashboardStats>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    getOverview: async (): Promise<AnalyticsOverview> => {
      const res = await this.client.get<ApiResponse<AnalyticsOverview>>('/api/v1/analytics/overview');
      return coercePaginated<AnalyticsOverview>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    getTrends: async (days = 30): Promise<{
      date: string;
      questions: number;
      likes: number;
      dislikes: number;
      avgResponseTime: number;
      uniqueUsers: number;
    }[]> => {
      const res = await this.client.get<ApiResponse<{
        data?: { date: string; questions: number; likes: number; dislikes: number; avgResponseTime: number; uniqueUsers: number }[];
      }>>('/api/v1/analytics/trends', { params: { days } });
      const coerced = coercePaginated<{
        date: string; questions: number; likes: number; dislikes: number; avgResponseTime: number; uniqueUsers: number;
      }>(res.data as unknown as Record<string, unknown>, 'data');
      return coerced.data.length ? coerced.data : (res.data as unknown as { data?: {
        date: string; questions: number; likes: number; dislikes: number; avgResponseTime: number; uniqueUsers: number;
      }[] })?.data || [];
    },

    getTopQuestions: async (
      limit = 10,
      from?: string,
      to?: string
    ): Promise<{ question: string; askCount: number; lastAskedAt: string }[]> => {
      const res = await this.client.get<ApiResponse<{
        data?: { question: string; askCount: number; lastAskedAt: string }[];
      }>>('/api/v1/analytics/top-questions', { params: { limit, from, to } });
      const coerced = coercePaginated<{ question: string; askCount: number; lastAskedAt: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      );
      return coerced.data.length ? coerced.data : (res.data as unknown as { data?: { question: string; askCount: number; lastAskedAt: string }[] })?.data || [];
    },

    getTopDocuments: async (limit = 10): Promise<{
      documentId: string;
      title: string;
      totalCitations: number;
      citationsLast7Days: number;
    }[]> => {
      const res = await this.client.get<ApiResponse<{
        data?: { documentId: string; title: string; totalCitations: number; citationsLast7Days: number }[];
      }>>('/api/v1/analytics/top-documents', { params: { limit } });
      const coerced = coercePaginated<{
        documentId: string; title: string; totalCitations: number; citationsLast7Days: number;
      }>(res.data as unknown as Record<string, unknown>, 'data');
      return coerced.data.length ? coerced.data : (res.data as unknown as { data?: {
        documentId: string; title: string; totalCitations: number; citationsLast7Days: number;
      }[] })?.data || [];
    },

    getUnansweredQuestions: async (params?: {
      page?: number;
      limit?: number;
      status?: string;
    }): Promise<{
      data: UnansweredQuestion[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const res = await this.client.get<
        ApiResponse<UnansweredQuestion[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/ai/unanswered', { params });
      const coerced = coercePaginated<UnansweredQuestion>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as { data?: UnansweredQuestion[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    resolveUnanswered: async (id: string, answer: string): Promise<void> => {
      await this.client.put(`/api/v1/ai/unanswered/${id}/resolve`, { answer });
    },
  };

  // ==========================================================================
  // Reports
  // ==========================================================================
  reports = {
    create: async (data: {
      type: string;
      format: string;
      dateFrom?: string;
      dateTo?: string;
      departmentId?: string;
    }): Promise<{ id: string; status: string; title: string }> => {
      const res = await this.client.post<ApiResponse<{
        id: string; status: string; title: string;
      }>>('/api/v1/reports', data);
      return coercePaginated<{ id: string; status: string; title: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? res.data.data!;
    },

    getStatus: async (id: string): Promise<{
      id: string;
      status: string;
      title: string;
      fileKey?: string;
      errorMessage?: string;
    }> => {
      const res = await this.client.get<ApiResponse<{
        id: string; status: string; title: string; fileKey?: string; errorMessage?: string;
      }>>(`/api/v1/reports/${id}`);
      return coercePaginated<{
        id: string; status: string; title: string; fileKey?: string; errorMessage?: string;
      }>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    download: async (id: string): Promise<Blob> => {
      const res = await this.client.get(`/api/v1/reports/${id}/download`, {
        responseType: 'blob',
      });
      return res.data;
    },

    list: async (params?: { page?: number; limit?: number }): Promise<{
      data: { id: string; title: string; type: string; format: string; status: string; createdAt: string }[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const res = await this.client.get<
        ApiResponse<{ id: string; title: string; type: string; format: string; status: string; createdAt: string }[]> &
        { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/reports', { params });
      const coerced = coercePaginated<{
        id: string; title: string; type: string; format: string; status: string; createdAt: string;
      }>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as {
          data?: { id: string; title: string; type: string; format: string; status: string; createdAt: string }[];
        })?.data || [],
        pagination: coerced.pagination,
      };
    },
  };

  // ==========================================================================
  // Audit Logs
  // ==========================================================================
  audit = {
    search: async (params?: {
      page?: number;
      limit?: number;
      action?: string;
      userId?: string;
      resourceType?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<{
      data: {
        id: string;
        userId: string;
        username: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        resourceName?: string;
        ipAddress?: string;
        createdAt: string;
      }[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const res = await this.client.get<
        ApiResponse<{
          id: string; userId: string; username: string; action: string;
          resourceType: string; resourceId?: string; resourceName?: string;
          ipAddress?: string; createdAt: string;
        }[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/analytics/audit-logs', { params });
      const coerced = coercePaginated<{
        id: string; userId: string; username: string; action: string;
        resourceType: string; resourceId?: string; resourceName?: string;
        ipAddress?: string; createdAt: string;
      }>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as { data?: {
          id: string; userId: string; username: string; action: string;
          resourceType: string; resourceId?: string; resourceName?: string;
          ipAddress?: string; createdAt: string;
        }[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    getById: async (id: string): Promise<{
      id: string;
      userId: string;
      username: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      resourceName?: string;
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      ipAddress?: string;
      createdAt: string;
    }> => {
      const res = await this.client.get<ApiResponse<{
        id: string; userId: string; username: string; action: string;
        resourceType: string; resourceId?: string; resourceName?: string;
        oldValue?: Record<string, unknown>; newValue?: Record<string, unknown>;
        ipAddress?: string; createdAt: string;
      }>>(`/api/v1/analytics/audit-logs/${id}`);
      return coercePaginated<{
        id: string; userId: string; username: string; action: string;
        resourceType: string; resourceId?: string; resourceName?: string;
        oldValue?: Record<string, unknown>; newValue?: Record<string, unknown>;
        ipAddress?: string; createdAt: string;
      }>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },
  };

  // ==========================================================================
  // Metadata (Categories, Tags, Access Rules)
  // ==========================================================================
  metadata = {
    // — Categories
    getCategories: async (): Promise<{
      id: string; name: string; slug: string;
      description?: string; parentId?: string; displayOrder?: number; isActive?: boolean;
    }[]> => {
      const res = await this.client.get<ApiResponse<{
        id: string; name: string; slug: string;
        description?: string; parentId?: string; displayOrder?: number; isActive?: boolean;
      }[]>>('/api/v1/categories/active');
      return coercePaginated<{
        id: string; name: string; slug: string;
        description?: string; parentId?: string; displayOrder?: number; isActive?: boolean;
      }>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    getCategoryById: async (id: string): Promise<{
      id: string; name: string; slug: string;
      description?: string; parentId?: string; displayOrder?: number; isActive?: boolean;
    }> => {
      const res = await this.client.get<ApiResponse<{
        id: string; name: string; slug: string;
        description?: string; parentId?: string; displayOrder?: number; isActive?: boolean;
      }>>(`/api/v1/categories/${id}`);
      return coercePaginated<{
        id: string; name: string; slug: string;
        description?: string; parentId?: string; displayOrder?: number; isActive?: boolean;
      }>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    createCategory: async (data: {
      name: string;
      slug?: string;
      description?: string;
      parentId?: string;
      displayOrder?: number;
    }): Promise<{ id: string; name: string; slug: string }> => {
      const res = await this.client.post<ApiResponse<{ id: string; name: string; slug: string }>>(
        '/api/v1/categories', data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? res.data.data!;
    },

    updateCategory: async (id: string, data: {
      name?: string;
      slug?: string;
      description?: string;
      displayOrder?: number;
    }): Promise<{ id: string; name: string; slug: string }> => {
      const res = await this.client.put<ApiResponse<{ id: string; name: string; slug: string }>>(
        `/api/v1/categories/${id}`, data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? res.data.data!;
    },

    deleteCategory: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/categories/${id}`);
    },

    // — Tags
    getTags: async (): Promise<{ id: string; name: string; slug: string; color?: string; usageCount?: number }[]> => {
      const res = await this.client.get<ApiResponse<{
        id: string; name: string; slug: string; color?: string; usageCount?: number;
      }[]>>('/api/v1/tags');
      return coercePaginated<{
        id: string; name: string; slug: string; color?: string; usageCount?: number;
      }>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    createTag: async (data: { name: string; color?: string }): Promise<{ id: string; name: string; slug: string }> => {
      const res = await this.client.post<ApiResponse<{ id: string; name: string; slug: string }>>(
        '/api/v1/tags', data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? res.data.data!;
    },

    updateTag: async (id: string, data: { name?: string; color?: string }): Promise<{
      id: string; name: string; slug: string;
    }> => {
      const res = await this.client.put<ApiResponse<{ id: string; name: string; slug: string }>>(
        `/api/v1/tags/${id}`, data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? res.data.data!;
    },

    deleteTag: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/tags/${id}`);
    },

    resolveTags: async (tagNames: string[]): Promise<{ id: string; name: string; slug: string }[]> => {
      const res = await this.client.post<ApiResponse<{ id: string; name: string; slug: string }[]>>(
        '/api/v1/tags/resolve', { tagNames }
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data;
    },

    // — Access Rules
    getAccessRules: async (documentId?: string): Promise<{
      id: string; documentMetadataId: string;
      targetType: string; targetRole?: string;
      targetDepartmentId?: string; targetUserId?: string;
      permission: string; createdAt: string;
    }[]> => {
      const res = await this.client.get<ApiResponse<{
        id: string; documentMetadataId: string;
        targetType: string; targetRole?: string;
        targetDepartmentId?: string; targetUserId?: string;
        permission: string; createdAt: string;
      }[]>>('/api/v1/access-rules', { params: { documentId } });
      return coercePaginated<{
        id: string; documentMetadataId: string;
        targetType: string; targetRole?: string;
        targetDepartmentId?: string; targetUserId?: string;
        permission: string; createdAt: string;
      }>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    createAccessRule: async (data: {
      documentMetadataId: string;
      targetType: string;
      targetRole?: string;
      targetDepartmentId?: string;
      targetUserId?: string;
      permission: string;
    }): Promise<{ id: string }> => {
      const res = await this.client.post<ApiResponse<{ id: string }>>('/api/v1/access-rules', data);
      return coercePaginated<{ id: string }>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    deleteAccessRule: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/access-rules/${id}`);
    },
  };
}

export const api = new ApiClient();
