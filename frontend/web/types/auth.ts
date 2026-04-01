// User Types
export interface User {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  department: string | null;
  departmentName?: string;
  fullName?: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum UserRole {
  USER = 'USER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
  REVOKED = 'REVOKED',
}

// Auth Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    userId: string;
    username: string;
    email: string;
    role: UserRole;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LogoutRequest {
  refreshToken: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
  traceId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
    retryAfter?: number;
  };
  timestamp: string;
  traceId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Session Types
export interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrentSession?: boolean;
}
