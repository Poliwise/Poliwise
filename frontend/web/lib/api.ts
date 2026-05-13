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
  ConversationListResponse,
  Message,
  ChatRequest,
  ChatResponse,
  SourceDocument,
  StreamEvent,
  ConversationHistory,
  UnansweredQuestion,
  DashboardStats,
  AnalyticsOverview,
  // Department types
  Department,
  DepartmentTreeNode,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  AssignUserDepartmentRequest,
} from '@/types';
import type { DocumentVersion } from '@/types/document';
import type { AccessRule, CreateAccessRuleRequest } from '@/types/document';

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

/**
 * Strip "Bearer " prefix from token if present.
 * This ensures tokens are stored without the prefix, and the Authorization header
 * is constructed correctly with the "Bearer " prefix added later.
 */
function normalizeToken(token: string): string {
  if (typeof token !== 'string') return token;
  const trimmed = token.trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.substring(7).trim();
  }
  return trimmed;
}

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

  return {
    accessToken: normalizeToken(data.accessToken),
    refreshToken: normalizeToken(data.refreshToken),
    expiresIn,
    user: data.user
  };
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

  return {
    accessToken: normalizeToken(data.accessToken),
    refreshToken: normalizeToken(data.refreshToken),
    expiresIn
  };
}

function coercePaginated<T>(
  response: unknown,
  dataKey: keyof Record<string, unknown>
): { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  const root = response as Record<string, unknown> | null;
  if (!root) return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };

  // Handle Spring/PageResponse format at root: { content, totalElements, totalPages, size, number }
  if ('content' in root && Array.isArray(root.content)) {
    const page = (root.number as number) ?? (root.page as number) ?? 0;
    const size = (root.size as number) ?? (root.limit as number) ?? 20;
    const totalElements = (root.totalElements as number) ?? 0;
    const totalPages = (root.totalPages as number) ?? 1;
    return {
      data: root.content as T[],
      pagination: {
        page: page + 1, // Spring uses 0-indexed
        limit: size,
        total: totalElements,
        totalPages,
      },
    };
  }

  // Handle wrapped ApiResponse format: { success, data: { content, totalElements, totalPages, size, ... }, ... }
  const wrappedData = (dataKey in root ? root[dataKey] : root) as Record<string, unknown> | undefined;
  if (wrappedData && 'content' in wrappedData && Array.isArray(wrappedData.content)) {
    const page = (wrappedData.number as number) ?? (wrappedData.page as number) ?? 0;
    const size = (wrappedData.size as number) ?? (wrappedData.limit as number) ?? 20;
    const totalElements = (wrappedData.totalElements as number) ?? 0;
    const totalPages = (wrappedData.totalPages as number) ?? 1;
    return {
      data: wrappedData.content as T[],
      pagination: {
        page: page + 1,
        limit: size,
        total: totalElements,
        totalPages,
      },
    };
  }

  // Handle wrapped ApiResponse with { success, data: [...], pagination: {...} }
  const dataArr = wrappedData as T[] | undefined;
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

  // Separate instance for logout and refresh — bypasses interceptors to prevent
  // infinite recursion when logout() is called by the 401-refresh chain
  private directClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Semaphore to prevent concurrent refresh attempts (stops refresh loops)
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private onTokenRefreshed(newToken: string) {
    this.refreshSubscribers.forEach((cb) => cb(newToken));
    this.refreshSubscribers = [];
  }

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
      // Use lowercase 'authorization' because Express normalizes all header keys to lowercase.
      // This ensures the header name is consistent when forwarded to downstream services.
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) config.headers['authorization'] = `Bearer ${token}`;
      const traceId = typeof window !== 'undefined' ? localStorage.getItem('traceId') : null;
      if (traceId) config.headers['x-trace-id'] = traceId;
      return config;
    });

    // — Response: handle 401 → token refresh → retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const original = error.config;
        if (!original) return Promise.reject(error);

        // 429 — don't retry, just reject
        if (error.response?.status === 429) {
          return Promise.reject(error);
        }

        if (error.response?.status === 401) {
          const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
          if (refreshToken) {
            if (this.isRefreshing) {
              // Another request is already refreshing — queue this one
              return new Promise((resolve, reject) => {
                this.subscribeTokenRefresh((newToken: string) => {
                  original.headers['authorization'] = `Bearer ${newToken}`;
                  // Use directClient to avoid reading stale token from localStorage
                  resolve(this.directClient({
                    ...original,
                    headers: {
                      ...(original.headers as Record<string, string>),
                      'authorization': `Bearer ${newToken}`,
                    },
                  }));
                });
                // Timeout: if refresh never resolves, reject
                setTimeout(() => reject(error), 10000);
              });
            }

            this.isRefreshing = true;
            try {
              // Use directClient to avoid interceptor recursion
              const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
              const refreshHeaders: Record<string, string> = {};
              if (userId) refreshHeaders['x-user-id'] = userId;
              const refreshRes = await this.directClient.post<unknown>(
                '/api/v1/auth/refresh',
                { refreshToken },
                { headers: refreshHeaders }
              );
              const tokens = coerceRefreshResponse(refreshRes.data);
              if (typeof window !== 'undefined') {
                localStorage.setItem('accessToken', tokens.accessToken);
                localStorage.setItem('refreshToken', tokens.refreshToken);
              }
              original.headers['authorization'] = `Bearer ${tokens.accessToken}`;

              // Notify all queued requests of the new token
              this.onTokenRefreshed(tokens.accessToken);
              this.isRefreshing = false;

              // Use directClient for retry to avoid stale localStorage token
              return this.directClient({
                ...original,
                headers: {
                  ...(original.headers as Record<string, string>),
                  'authorization': `Bearer ${tokens.accessToken}`,
                },
              });
            } catch {
              this.isRefreshing = false;
              this.refreshSubscribers = [];
              // Refresh failed — clear all tokens FIRST, then redirect
              if (typeof window !== 'undefined') {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('userRole');
                localStorage.removeItem('auth-storage');
              }
              if (typeof window !== 'undefined') window.location.href = '/login';
              return Promise.reject(error);
            }
          } else {
            // No refresh token
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('userId');
              localStorage.removeItem('userRole');
              localStorage.removeItem('auth-storage');
            }
            if (typeof window !== 'undefined') window.location.href = '/login';
            return Promise.reject(error);
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
      const token = refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null);
      if (token) {
        try {
          // Use directClient so this call does NOT re-trigger the 401 refresh chain
          await this.directClient.post('/api/v1/auth/logout', { refreshToken: token });
        } catch { /* ignore */ }
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
      }
    },

    logoutAll: async (): Promise<void> => {
      await this.client.post('/api/v1/auth/logout-all');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
    },

    getSessions: async (): Promise<Session[]> => {
      const res = await this.client.get<{ sessions: Session[] }>('/api/v1/auth/sessions');
      const root = res.data as Record<string, unknown>;
      const sessions = root.sessions;
      if (Array.isArray(sessions)) {
        return sessions as Session[];
      }
      return [];
    },

    revokeSession: async (sessionId: string): Promise<void> => {
      await this.client.delete(`/api/v1/auth/sessions/${sessionId}`);
    },

    forgotPassword: async (email: string): Promise<{ message: string; emailSent: boolean }> => {
      const res = await this.client.post<{ message: string; emailSent: boolean }>(
        '/api/v1/auth/forgot-password',
        { email }
      );
      return res.data;
    },

    changePassword: async (data: {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
    }): Promise<{ success: boolean; message: string }> => {
      const res = await this.client.post<{ success: boolean; message: string }>(
        '/api/v1/auth/change-password',
        data
      );
      return res.data;
    },

    getProfile: async (): Promise<{
      id: string;
      username: string;
      email: string;
      role: string;
      status: string;
      departmentId: string | null;
      departmentName: string | null;
      createdAt: string;
      passwordChangedAt: string | null;
      mustChangePassword: boolean;
    }> => {
      const res = await this.client.get<{
        id: string;
        username: string;
        email: string;
        role: string;
        status: string;
        departmentId: string | null;
        departmentName: string | null;
        createdAt: string;
        passwordChangedAt: string | null;
        mustChangePassword: boolean;
      }>('/api/v1/auth/me');
      return res.data;
    },
  };

  // ==========================================================================
  // Profile (user-service — full profile with extended fields)
  // ==========================================================================
  profile = {
    /** Fetches extended profile from user-service + auth metadata from auth-service */
    getFull: async (): Promise<{
      id: string;
      username: string;
      email: string;
      role: string;
      status: string;
      departmentId: string | null;
      departmentName: string | null;
      createdAt: string;
      passwordChangedAt: string | null;
      mustChangePassword: boolean;
      fullName?: string;
      phone?: string | null;
      position?: string | null;
      bio?: string | null;
      dateOfBirth?: string | null;
      employeeCode?: string | null;
      joinedDate?: string | null;
    }> => {
      // user-service: extended profile (fullName, phone, position, bio, etc.)
      const profileRes = await this.client.get<{
        id: string;
        username: string;
        email: string;
        role: string;
        accountStatus: string;
        department: { id: string; name: string; code: string } | null;
        profile: {
          id: string;
          fullName: string;
          phone: string | null;
          position: string | null;
          avatarUrl: string | null;
          bio: string | null;
          dateOfBirth: string | null;
          employeeCode: string | null;
          joinedDate: string | null;
        } | null;
        createdAt: string;
        updatedAt: string;
      }>('/api/v1/users/me');

      // auth-service: auth metadata (passwordChangedAt, mustChangePassword)
      const authRes = await this.client.get<{
        id: string;
        passwordChangedAt: string | null;
        mustChangePassword: boolean;
      }>('/api/v1/auth/me');

      const p = profileRes.data;
      const a = authRes.data;

      return {
        id: p.id,
        username: p.username,
        email: p.email,
        role: p.role,
        status: p.accountStatus,
        departmentId: p.department?.id ?? null,
        departmentName: p.department?.name ?? null,
        createdAt: p.createdAt,
        passwordChangedAt: a.passwordChangedAt ?? null,
        mustChangePassword: a.mustChangePassword ?? false,
        fullName: p.profile?.fullName,
        phone: p.profile?.phone,
        position: p.profile?.position,
        bio: p.profile?.bio,
        dateOfBirth: p.profile?.dateOfBirth,
        employeeCode: p.profile?.employeeCode,
        joinedDate: p.profile?.joinedDate,
      };
    },

    update: async (data: {
      fullName?: string;
      phone?: string;
      position?: string;
      avatarUrl?: string;
      bio?: string;
      dateOfBirth?: string;
    }): Promise<unknown> => {
      const res = await this.client.put<unknown>('/api/v1/users/me', data);
      return res.data;
    },
  };

  // ==========================================================================
  // Users
  // ==========================================================================
  users = {
    getMe: async (): Promise<User> => {
      const res = await this.client.get<ApiResponse<User>>('/api/v1/users/me');
      const raw = coercePaginated<User>(res.data, 'data').data[0] ?? (res.data as unknown as User);
      return {
        ...raw,
        department: typeof raw.department === 'object' && raw.department !== null
          ? (raw.department as { id: string }).id
          : (raw.department as string | null),
        departmentName: typeof raw.department === 'object' && raw.department !== null
          ? (raw.department as { name: string }).name
          : undefined,
      };
    },

    getById: async (userId: string): Promise<User> => {
      const res = await this.client.get<ApiResponse<User>>(`/api/v1/users/${userId}`);
      const raw = coercePaginated<User>(res.data, 'data').data[0] ?? (res.data as unknown as User);
      return {
        ...raw,
        department: typeof raw.department === 'object' && raw.department !== null
          ? (raw.department as { id: string }).id
          : (raw.department as string | null),
        departmentName: typeof raw.department === 'object' && raw.department !== null
          ? (raw.department as { name: string }).name
          : undefined,
      };
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
      const rawUsers: User[] = coerced.data.length ? coerced.data : (res.data as unknown as { data?: User[] })?.data || [];
      const users: User[] = rawUsers.map((u) => ({
        ...u,
        department: typeof u.department === 'object' && u.department !== null
          ? (u.department as { id: string }).id
          : (u.department as string | null),
        departmentName: typeof u.department === 'object' && u.department !== null
          ? (u.department as { name: string }).name
          : undefined,
      }));
      return {
        data: users,
        pagination: coerced.pagination,
      };
    },

    create: async (data: {
      username: string;
      email: string;
      fullName: string;
      role: string;
      departmentId?: string;
    }): Promise<{ userId: string; username: string; email: string; role: string; status: string }> => {
      const res = await this.client.post<ApiResponse<{
        userId: string;
        username: string;
        email: string;
        role: string;
        status: string;
      }>>('/api/v1/users', data);
      return res.data as unknown as { userId: string; username: string; email: string; role: string; status: string };
    },

    bulkCreate: async (users: Array<{
      username: string;
      email: string;
      fullName: string;
      role: string;
      departmentId?: string;
    }>): Promise<{
      totalRequested: number;
      successCount: number;
      failureCount: number;
      successfulUsers: Array<{
        userId: string;
        username: string;
        email: string;
        tempPassword: string;
        emailSent: boolean;
      }>;
      failedUsers: Array<{
        username: string;
        email: string;
        error: string;
      }>;
    }> => {
      const res = await this.client.post<{
        totalRequested: number;
        successCount: number;
        failureCount: number;
        successfulUsers: Array<{
          userId: string;
          username: string;
          email: string;
          tempPassword: string;
          emailSent: boolean;
        }>;
        failedUsers: Array<{
          username: string;
          email: string;
          error: string;
        }>;
      }>('/api/v1/users/bulk', { users });
      return res.data;
    },

    update: async (userId: string, data: {
      fullName?: string;
      role?: string;
      status?: string;
      departmentId?: string;
    }): Promise<{
      id: string;
      username: string;
      email: string;
      role: string;
      status: string;
    }> => {
      const res = await this.client.put<ApiResponse<{
        id: string;
        username: string;
        email: string;
        role: string;
        status: string;
      }>>(`/api/v1/users/${userId}`, data);
      return coercePaginated<{
        id: string;
        username: string;
        email: string;
        role: string;
        status: string;
      }>(res.data, 'data').data[0] ?? (res.data as unknown as {
        id: string;
        username: string;
        email: string;
        role: string;
        status: string;
      });
    },

    deactivate: async (userId: string): Promise<void> => {
      await this.client.post(`/api/v1/users/${userId}/deactivate`);
    },

    reactivate: async (userId: string): Promise<void> => {
      await this.client.post(`/api/v1/users/${userId}/reactivate`);
    },

    revoke: async (userId: string): Promise<void> => {
      await this.client.post(`/api/v1/users/${userId}/revoke`);
    },

    delete: async (userId: string): Promise<void> => {
      await this.client.delete(`/api/v1/users/${userId}`);
    },

    getLoginHistory: async (userId: string, params?: {
      page?: number;
      limit?: number;
    }): Promise<{
      data: Array<{
        id: string;
        username: string;
        ipAddress: string;
        deviceType: string;
        location: string;
        status: string;
        failureReason: string | null;
        createdAt: string;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      const res = await this.client.get<ApiResponse<Array<{
        id: string;
        username: string;
        ipAddress: string;
        deviceType: string;
        location: string;
        status: string;
        failureReason: string | null;
        createdAt: string;
      }>>>(`/api/v1/users/${userId}/login-history`, { params });
      const coerced = coercePaginated<{
        id: string;
        username: string;
        ipAddress: string;
        deviceType: string;
        location: string;
        status: string;
        failureReason: string | null;
        createdAt: string;
      }>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data,
        pagination: coerced.pagination,
      };
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

    getById: async (id: string): Promise<Document & { versions?: DocumentVersion[] }> => {
      const res = await this.client.get<ApiResponse<Document & { versions?: DocumentVersion[] }>>(
        `/api/v1/documents/${id}`
      );
      // Handle wrapped { success: true, data: {...} } format
      const root = res.data as unknown as Record<string, unknown> | null;
      if (root && 'data' in root && root.data && typeof root.data === 'object') {
        return root.data as Document & { versions?: DocumentVersion[] };
      }
      // Handle raw DocumentDetailResponse with versions array
      if (root && 'versions' in root) {
        return root as unknown as Document & { versions?: DocumentVersion[] };
      }
      // Fallback: coercePaginated for single-object responses
      const coerced = coercePaginated<Document & { versions?: DocumentVersion[] }>(
        res.data as unknown as Record<string, unknown>, 'data'
      );
      return coerced.data[0] ?? (res.data as unknown as { data?: Document & { versions?: DocumentVersion[] } })?.data;
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
      // Use fetch directly with correct API Gateway URL (not axios client which defaults to frontend port 3000)
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const apiUrl = API_BASE_URL.replace(':3000', ':3001') || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/documents/${id}/download`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      return res.blob();
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
        `/api/v1/documents/${documentId}/confirm`,
        data
      );
      return res.data as DocumentUploadResponse;
    },

    cancel: async (documentId: string): Promise<void> => {
      await this.client.delete(`${KNOWLEDGE_SERVICE_URL}/api/v1/documents/${documentId}/cancel`);
    },

    getVersions: async (documentId: string): Promise<DocumentVersion[]> => {
      const res = await this.client.get<ApiResponse<DocumentVersion[]>>(
        `/api/v1/documents/${documentId}/versions`
      );
      const coerced = coercePaginated<DocumentVersion>(res.data as unknown as Record<string, unknown>, 'data');
      return coerced.data;
    },

    triggerProcess: async (documentId: string): Promise<void> => {
      await this.client.post(`/api/v1/documents/${documentId}/process`);
    },

    getContent: async (documentId: string, versionNumber: number): Promise<string> => {
      const res = await this.client.get<{ data?: { content: string }; content?: string }>(
        `/api/v1/documents/${documentId}/versions/${versionNumber}/content`
      );
      // Handle both wrapped and unwrapped formats
      return res.data?.data?.content ?? res.data?.content ?? '';
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
      const res = await this.client.post<ApiResponse<QuestionResponse>>('/api/v1/ai/chat', { message: data.question, conversationId: data.conversationId });
      return coercePaginated<QuestionResponse>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    chat: async (data: ChatRequest): Promise<ChatResponse> => {
      const res = await this.client.post<ApiResponse<ChatResponse>>('/api/v1/ai/chat', data);
      return coercePaginated<ChatResponse>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    askStream: (data: QuestionRequest, signal?: AbortSignal): ReadableStream<StreamEvent> => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      const stream = new ReadableStream<StreamEvent>({
        async start(controller) {
          try {
            const response = await fetch('/api/v1/ai/chat/stream', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
              },
              body: JSON.stringify(data),
              signal,
            });

            if (!response.body) {
              controller.enqueue({ type: 'error', error: 'No response body' });
              controller.close();
              return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') {
                    controller.enqueue({ type: 'done' });
                  } else {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.conversationId) {
                        controller.enqueue({ type: 'conversationId', conversationId: parsed.conversationId });
                      } else if (parsed.sources) {
                        controller.enqueue({ type: 'sources', sources: parsed.sources });
                      } else if (parsed.content !== undefined) {
                        controller.enqueue({ type: 'content', content: parsed.content });
                      } else if (parsed.error) {
                        controller.enqueue({ type: 'error', error: parsed.error });
                      }
                    } catch { /* skip malformed */ }
                  }
                }
              }
            }
          } catch (err) {
            controller.enqueue({ type: 'error', error: err instanceof Error ? err.message : 'Stream failed' });
          } finally {
            controller.close();
          }
        },
      });
      return stream;
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

    getConversationList: async (params?: {
      page?: number;
      size?: number;
      keyword?: string;
    }): Promise<ConversationListResponse> => {
      const res = await this.client.get<ApiResponse<ConversationListResponse>>('/api/v1/ai/conversations', { params });
      const root = res.data as unknown as Record<string, unknown> | null;
      if (root && 'data' in root && typeof root.data === 'object' && root.data !== null) {
        return root.data as ConversationListResponse;
      }
      return coercePaginated<ConversationListResponse>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data as unknown as ConversationListResponse;
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
        messageId,
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
      return coerced.data.length ? coerced.data : (res.data as unknown as {
        data?: {
          date: string; questions: number; likes: number; dislikes: number; avgResponseTime: number; uniqueUsers: number;
        }[]
      })?.data || [];
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
      return coerced.data.length ? coerced.data : (res.data as unknown as {
        data?: {
          documentId: string; title: string; totalCitations: number; citationsLast7Days: number;
        }[]
      })?.data || [];
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

    resolveUnanswered: async (id: string, data: { answer: string }): Promise<void> => {
      await this.client.put(`/api/v1/ai/unanswered/${id}/resolve`, data);
    },

    rejectUnanswered: async (id: string): Promise<void> => {
      await this.client.put(`/api/v1/ai/unanswered/${id}/reject`);
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
      resourceId?: string;
      startDate?: string;
      endDate?: string;
      search?: string; // Generic keyword search
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
        data: coerced.data.length ? coerced.data : (res.data as unknown as {
          data?: {
            id: string; userId: string; username: string; action: string;
            resourceType: string; resourceId?: string; resourceName?: string;
            ipAddress?: string; createdAt: string;
          }[]
        })?.data || [],
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
      }>>(`/api/v1/metadata/categories/${id}`);
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
        '/api/v1/metadata/categories', data
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
        `/api/v1/metadata/categories/${id}`, data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? res.data.data!;
    },

    deleteCategory: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/metadata/categories/${id}`);
    },

    // — Tags
    getTags: async (): Promise<{ id: string; name: string; slug: string; color?: string; usageCount?: number }[]> => {
      const res = await this.client.get<ApiResponse<{
        id: string; name: string; slug: string; color?: string; usageCount?: number;
      }[]>>('/api/v1/metadata/tags');
      return coercePaginated<{
        id: string; name: string; slug: string; color?: string; usageCount?: number;
      }>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    createTag: async (data: { name: string; color?: string }): Promise<{ id: string; name: string; slug: string }> => {
      const res = await this.client.post<ApiResponse<{ id: string; name: string; slug: string }>>(
        '/api/v1/metadata/tags', data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? { id: '', name: '', slug: '' };
    },

    updateTag: async (id: string, data: { name?: string; color?: string }): Promise<{
      id: string; name: string; slug: string;
    }> => {
      const res = await this.client.put<ApiResponse<{ id: string; name: string; slug: string }>>(
        `/api/v1/metadata/tags/${id}`, data
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data[0] ?? { id: '', name: '', slug: '' };
    },

    deleteTag: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/metadata/tags/${id}`);
    },

    resolveTags: async (tagNames: string[]): Promise<{ id: string; name: string; slug: string }[]> => {
      const res = await this.client.post<ApiResponse<{ id: string; name: string; slug: string }[]>>(
        '/api/v1/metadata/tags/resolve', { tagNames }
      );
      return coercePaginated<{ id: string; name: string; slug: string }>(
        res.data as unknown as Record<string, unknown>, 'data'
      ).data;
    },

    // — Access Rules
    getAccessRules: async (metadataId: string): Promise<AccessRule[]> => {
      const res = await this.client.get<ApiResponse<AccessRule[]>>('/api/v1/access-rules', { params: { metadataId } });
      return coercePaginated<AccessRule>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    getAllAccessRules: async (): Promise<AccessRule[]> => {
      const res = await this.client.get<{
        success: boolean;
        data?: AccessRule[];
      }>('/api/v1/access-rules/all');
      return res.data?.data ?? [];
    },

    getAccessRulesByDocumentId: async (documentId: string): Promise<AccessRule[]> => {
      const res = await this.client.get<AccessRule[] | {
        success: boolean;
        data?: AccessRule[];
        _proxied?: boolean;
      }>(`/api/v1/access-rules/by-document/${documentId}`);
      // Backend may return raw array, wrapped {success, data}, or proxied {_proxied, data}
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (raw && '_proxied' in raw) return (raw as { _proxied: boolean; data: AccessRule[] }).data ?? [];
      return (raw as { success: boolean; data?: AccessRule[] })?.data ?? [];
    },

    createAccessRule: async (data: CreateAccessRuleRequest): Promise<{ id: string }> => {
      const res = await this.client.post<ApiResponse<{ id: string }>>('/api/v1/access-rules', data);
      return coercePaginated<{ id: string }>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    updateAccessRule: async (id: string, data: {
      targetType: string;
      permission: string;
      targetRole?: string;
      targetDepartmentId?: string;
      targetUserId?: string;
    }): Promise<{ id: string }> => {
      const res = await this.client.put<ApiResponse<{ id: string }>>(`/api/v1/access-rules/${id}`, data);
      return coercePaginated<{ id: string }>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    deleteAccessRule: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/metadata/access-rules/${id}`);
    },

    simulateAccess: async (documentId: string): Promise<{
      documentId: string;
      metadataId: string;
      totalCompanyUsers: number;
      usersWithAccess: number;
      usersWithoutAccess: number;
      grantedUsers: Array<{
        userId: string;
        username: string;
        fullName: string | null;
        role: string | null;
        departmentId: string;
        departmentName: string;
        hasAccess: boolean;
        reason: string;
        simulatedAt: string;
      }>;
      deniedUsers: Array<{
        userId: string;
        username: string;
        fullName: string | null;
        role: string | null;
        departmentId: string;
        departmentName: string;
        hasAccess: boolean;
        reason: string;
        simulatedAt: string;
      }>;
      simulatedAt: string;
    }> => {
      const res = await this.client.get<{
        documentId: string;
        metadataId: string;
        totalCompanyUsers: number;
        usersWithAccess: number;
        usersWithoutAccess: number;
        grantedUsers: Array<{
          userId: string;
          username: string;
          fullName: string | null;
          role: string | null;
          departmentId: string;
          departmentName: string;
          hasAccess: boolean;
          reason: string;
          simulatedAt: string;
        }>;
        deniedUsers: Array<{
          userId: string;
          username: string;
          fullName: string | null;
          role: string | null;
          departmentId: string;
          departmentName: string;
          hasAccess: boolean;
          reason: string;
          simulatedAt: string;
        }>;
        simulatedAt: string;
      }>(`/api/v1/access-rules/simulation/by-document/${documentId}`);
      // Backend may return raw object or proxied {_proxied, data} wrapper
      const raw = res.data;
      if (raw && '_proxied' in raw) return (raw as unknown as { _proxied: boolean; data: unknown }).data as typeof res.data;
      return res.data;
    },
  };

  // ==========================================================================
  // Departments
  // ==========================================================================
  departments = {
    getAll: async (params?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortDir?: string;
    }): Promise<{ data: Department[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
      const res = await this.client.get<
        ApiResponse<Department[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >('/api/v1/departments', { params });
      const coerced = coercePaginated<Department>(res.data as unknown as Record<string, unknown>, 'data');
      return {
        data: coerced.data.length ? coerced.data : (res.data as unknown as { data?: Department[] })?.data || [],
        pagination: coerced.pagination,
      };
    },

    getById: async (id: string): Promise<Department> => {
      const res = await this.client.get<ApiResponse<Department>>(`/api/v1/departments/${id}`);
      return coercePaginated<Department>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    getActive: async (): Promise<Department[]> => {
      const res = await this.client.get<ApiResponse<Department[]>>('/api/v1/departments/active');
      return coercePaginated<Department>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    getTree: async (): Promise<DepartmentTreeNode[]> => {
      const res = await this.client.get<ApiResponse<DepartmentTreeNode[]>>('/api/v1/departments/tree');
      return coercePaginated<DepartmentTreeNode>(res.data as unknown as Record<string, unknown>, 'data').data;
    },

    create: async (data: CreateDepartmentRequest): Promise<Department> => {
      const res = await this.client.post<ApiResponse<Department>>('/api/v1/departments', data);
      return coercePaginated<Department>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    update: async (id: string, data: UpdateDepartmentRequest): Promise<Department> => {
      const res = await this.client.put<ApiResponse<Department>>(`/api/v1/departments/${id}`, data);
      return coercePaginated<Department>(res.data as unknown as Record<string, unknown>, 'data').data[0] ?? res.data.data!;
    },

    delete: async (id: string): Promise<void> => {
      await this.client.delete(`/api/v1/departments/${id}`);
    },

    getUsers: async (departmentId: string, params?: {
      page?: number;
      limit?: number;
    }): Promise<{ data: User[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
      const res = await this.client.get<
        ApiResponse<User[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
      >(`/api/v1/departments/${departmentId}/users`, { params });
      const coerced = coercePaginated<User>(res.data as unknown as Record<string, unknown>, 'data');
      const rawUsers: User[] = coerced.data.length ? coerced.data : (res.data as unknown as { data?: User[] })?.data || [];
      const users: User[] = rawUsers.map((u) => ({
        ...u,
        department: typeof u.department === 'object' && u.department !== null
          ? (u.department as { id: string }).id
          : (u.department as string | null),
        departmentName: typeof u.department === 'object' && u.department !== null
          ? (u.department as { name: string }).name
          : undefined,
      }));
      return {
        data: users,
        pagination: coerced.pagination,
      };
    },

    assignUser: async (data: AssignUserDepartmentRequest): Promise<User> => {
      const res = await this.client.post<ApiResponse<User>>('/api/v1/departments/assign-user', data);
      const raw = coercePaginated<User>(res.data as unknown as Record<string, unknown>, 'data').data[0]
        ?? (res.data as unknown as User);
      return {
        ...raw,
        department: typeof raw.department === 'object' && raw.department !== null
          ? (raw.department as { id: string }).id
          : (raw.department as string | null),
        departmentName: typeof raw.department === 'object' && raw.department !== null
          ? (raw.department as { name: string }).name
          : undefined,
      };
    },
  };
}

export const api = new ApiClient();
