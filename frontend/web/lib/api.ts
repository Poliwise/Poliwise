import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  ApiResponse,
  ApiError,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  User,
  Session,
  Document,
  DocumentSearchParams,
  Conversation,
  ConversationHistory,
  QuestionRequest,
  QuestionResponse,
  AnalyticsOverview,
  DashboardStats,
  UnansweredQuestion,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type RawTokenBody = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresInSeconds?: number;
  user?: LoginResponse['user'];
};

function coerceLoginResponse(body: unknown): LoginResponse {
  const root = body as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') {
    throw new Error('Phản hồi đăng nhập không hợp lệ');
  }
  const payload =
    'data' in root &&
    root.data &&
    typeof root.data === 'object' &&
    'accessToken' in (root.data as object)
      ? (root.data as RawTokenBody & { user: LoginResponse['user'] })
      : (root as RawTokenBody & { user: LoginResponse['user'] });

  const expiresIn =
    typeof payload.expiresIn === 'number'
      ? payload.expiresIn
      : typeof payload.expiresInSeconds === 'number'
        ? payload.expiresInSeconds
        : 0;

  if (!payload.accessToken || !payload.refreshToken || !payload.user) {
    throw new Error('Phản hồi đăng nhập không hợp lệ');
  }

  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresIn,
    user: payload.user,
  };
}

function coerceRefreshResponse(body: unknown): RefreshTokenResponse {
  const root = body as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') {
    throw new Error('Phản hồi làm mới token không hợp lệ');
  }
  const payload =
    'data' in root &&
    root.data &&
    typeof root.data === 'object' &&
    'accessToken' in (root.data as object)
      ? (root.data as RawTokenBody)
      : (root as RawTokenBody);

  const expiresIn =
    typeof payload.expiresIn === 'number'
      ? payload.expiresIn
      : typeof payload.expiresInSeconds === 'number'
        ? payload.expiresInSeconds
        : 0;

  if (!payload.accessToken || !payload.refreshToken) {
    throw new Error('Phản hồi làm mới token không hợp lệ');
  }

  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresIn,
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add trace ID if exists
        const traceId = typeof window !== 'undefined' ? localStorage.getItem('traceId') : null;
        if (traceId) {
          config.headers['X-Trace-ID'] = traceId;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest) {
          // Try to refresh token
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const tokens = await this.auth.refresh(refreshToken);
              localStorage.setItem('accessToken', tokens.accessToken);
              localStorage.setItem('refreshToken', tokens.refreshToken);

              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              return this.client(originalRequest);
            } catch {
              // Refresh failed, logout
              this.auth.logout();
              window.location.href = '/login';
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  auth = {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
      const response = await this.client.post<unknown>('/api/v1/auth/login', data);
      return coerceLoginResponse(response.data);
    },

    register: async (data: { username: string; email: string; password: string }): Promise<void> => {
      await this.client.post('/api/v1/auth/register', data);
    },

    refresh: async (refreshToken: string): Promise<RefreshTokenResponse> => {
      const response = await this.client.post<unknown>(
        '/api/v1/auth/refresh',
        { refreshToken },
        {
          headers: {
            'X-User-Id': localStorage.getItem('userId') || '',
          },
        },
      );
      return coerceRefreshResponse(response.data);
    },

    logout: async (): Promise<void> => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          await this.client.post('/api/v1/auth/logout', { refreshToken });
        } catch {
          // Ignore errors
        }
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
      const response = await this.client.get<ApiResponse<Session[]>>('/api/v1/auth/sessions');
      return response.data.data || [];
    },
  };

  // User endpoints
  users = {
    getMe: async (): Promise<User> => {
      const response = await this.client.get<ApiResponse<User>>('/api/v1/users/me');
      return response.data.data!;
    },

    getById: async (userId: string): Promise<User> => {
      const response = await this.client.get<ApiResponse<User>>(`/api/v1/users/${userId}`);
      return response.data.data!;
    },

    updateMe: async (data: Partial<User>): Promise<User> => {
      const response = await this.client.put<ApiResponse<User>>('/api/v1/users/me', data);
      return response.data.data!;
    },

    updateDepartment: async (departmentId: string): Promise<void> => {
      await this.client.patch(`/api/v1/users/me/department`, { departmentId });
    },

    search: async (params?: { page?: number; limit?: number; search?: string; role?: string; department?: string }): Promise<{
      data: User[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const response = await this.client.get<ApiResponse<User[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }>('/api/v1/users', { params });
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    },

    updateStatus: async (userId: string, status: string): Promise<void> => {
      await this.client.patch(`/api/v1/users/${userId}/status`, { status });
    },

    delete: async (userId: string): Promise<void> => {
      await this.client.delete(`/api/v1/users/${userId}`);
    },
  };

  // Document endpoints
  documents = {
    getAll: async (params?: DocumentSearchParams): Promise<{
      data: Document[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const response = await this.client.get<ApiResponse<Document[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }>('/api/v1/documents', { params });
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    },

    getById: async (id: string): Promise<Document> => {
      const response = await this.client.get<ApiResponse<Document>>(`/api/v1/documents/${id}`);
      return response.data.data!;
    },

    upload: async (formData: FormData): Promise<Document> => {
      const response = await this.client.post<ApiResponse<Document>>('/api/v1/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data!;
    },

    delete: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/documents/${id}`);
    },

    download: async (id: string): Promise<Blob> => {
      const response = await this.client.get(`/api/v1/documents/${id}/download`, {
        responseType: 'blob',
      });
      return response.data;
    },
  };

  // AI endpoints
  ai = {
    ask: async (data: QuestionRequest): Promise<QuestionResponse> => {
      const response = await this.client.post<ApiResponse<QuestionResponse>>('/api/v1/ai/ask', data);
      return response.data.data!;
    },

    getHistory: async (params?: { page?: number; limit?: number }): Promise<ConversationHistory> => {
      const response = await this.client.get<ApiResponse<Conversation[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }>('/api/v1/ai/history', { params });
      return {
        conversations: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    },

    giveFeedback: async (conversationId: string, type: 'LIKE' | 'DISLIKE', comment?: string): Promise<void> => {
      await this.client.post('/api/v1/feedback', {
        conversationId,
        type,
        comment,
      });
    },
  };

  // Analytics endpoints
  analytics = {
    getDashboard: async (): Promise<DashboardStats> => {
      const response = await this.client.get<ApiResponse<DashboardStats>>('/api/v1/analytics/dashboard');
      return response.data.data!;
    },

    getOverview: async (): Promise<AnalyticsOverview> => {
      const response = await this.client.get<ApiResponse<AnalyticsOverview>>('/api/v1/analytics/overview');
      return response.data.data!;
    },

    getUnansweredQuestions: async (params?: { page?: number; limit?: number }): Promise<{
      data: UnansweredQuestion[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const response = await this.client.get<ApiResponse<UnansweredQuestion[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }>('/api/v1/ai/unanswered', { params });
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    },
  };

  // Metadata endpoints
  metadata = {
    getCategories: async (): Promise<{ id: string; name: string }[]> => {
      const response = await this.client.get<ApiResponse<{ id: string; name: string }[]>>('/api/v1/metadata/categories');
      return response.data.data || [];
    },

    getTags: async (): Promise<{ id: string; name: string }[]> => {
      const response = await this.client.get<ApiResponse<{ id: string; name: string }[]>>('/api/v1/metadata/tags');
      return response.data.data || [];
    },
  };
}

export const api = new ApiClient();
