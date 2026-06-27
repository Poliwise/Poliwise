// ============================================================
// Violation Management Types
// ============================================================

// Violation Type - categorizes the type of violation
export enum ViolationType {
  TOXIC_QUERY = 'TOXIC_QUERY',
  ABUSE = 'ABUSE',
  SPAM = 'SPAM',
  POLICY_BREAK = 'POLICY_BREAK',
}

// Violation Severity - indicates how severe the violation is
export enum ViolationSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Violation Status - current state of the violation
export enum ViolationStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACTIONED = 'ACTIONED',
}

// Violation Action - action taken by admin in response to violation
export enum ViolationAction {
  DISMISSED = 'DISMISSED',
  WARNED = 'WARNED',
  DEACTIVATED = 'DEACTIVATED',
  REVOKED = 'REVOKED',
}

// Appeal Status - status of user's appeal
export enum AppealStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Source of violation report
export enum ViolationSource {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
}

// ============================================================
// Core Entity Types
// ============================================================

export interface Violation {
  id: string;
  userId: string;
  userUsername?: string;
  userFullName?: string;
  violationType: ViolationType;
  severity: ViolationSeverity;
  evidence: string;
  source: ViolationSource;
  reportedBy?: string;
  status: ViolationStatus;
  actionTaken?: ViolationAction;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  appealStatus: AppealStatus;
  appealText?: string;
  appealReviewedAt?: string;
  appealReviewedBy?: string;
  deletedAt?: string;
  userDepartmentId?: string;
  userRole?: string;
}

export interface Warning {
  id: string;
  userId: string;
  violationId?: string;
  message: string;
  expiresAt: string;
  createdAt: string;
  readAt?: string;
  userDepartmentId?: string;
}

// ============================================================
// API Request Types
// ============================================================

export interface AppealRequest {
  appealText: string;
}

export interface ReviewViolationRequest {
  action: ViolationAction;
}

export interface ReviewAppealRequest {
  approved: boolean;
}

// ============================================================
// API Response Types
// ============================================================

export interface ViolationStats {
  pendingViolations: number;
  totalViolations?: number;
  pendingAppeals?: number;
  totalWarnings?: number;
}

// ============================================================
// Search/Filter Types
// ============================================================

export interface ViolationSearchParams {
  page?: number;
  limit?: number;
  status?: ViolationStatus;
  severity?: ViolationSeverity;
  violationType?: ViolationType;
  startDate?: string;
  endDate?: string;
}

export interface WarningSearchParams {
  page?: number;
  limit?: number;
  read?: boolean;
}

export interface AppealSearchParams {
  page?: number;
  limit?: number;
  status?: AppealStatus;
}

// ============================================================
// UI Helper Types
// ============================================================

export interface ViolationWithUser extends Violation {
  user?: {
    id: string;
    username: string;
    fullName?: string;
    role?: string;
    departmentId?: string;
  };
}

export interface WarningDisplay extends Warning {
  isExpired?: boolean;
  isRead?: boolean;
}

// ============================================================
// Display Labels
// ============================================================

export const ViolationTypeLabels: Record<ViolationType, string> = {
  [ViolationType.TOXIC_QUERY]: 'Câu hỏi độc hại',
  [ViolationType.ABUSE]: 'Lạm dụng',
  [ViolationType.SPAM]: 'Spam',
  [ViolationType.POLICY_BREAK]: 'Vi phạm chính sách',
};

export const ViolationSeverityLabels: Record<ViolationSeverity, string> = {
  [ViolationSeverity.LOW]: 'Thấp',
  [ViolationSeverity.MEDIUM]: 'Trung bình',
  [ViolationSeverity.HIGH]: 'Cao',
};

export const ViolationStatusLabels: Record<ViolationStatus, string> = {
  [ViolationStatus.PENDING]: 'Đang chờ',
  [ViolationStatus.REVIEWED]: 'Đã duyệt',
  [ViolationStatus.ACTIONED]: 'Đã xử lý',
};

export const ViolationActionLabels: Record<ViolationAction, string> = {
  [ViolationAction.DISMISSED]: 'Bỏ qua',
  [ViolationAction.WARNED]: 'Cảnh cáo',
  [ViolationAction.DEACTIVATED]: 'Vô hiệu hóa',
  [ViolationAction.REVOKED]: 'Thu hồi',
};

export const AppealStatusLabels: Record<AppealStatus, string> = {
  [AppealStatus.PENDING]: 'Đang chờ',
  [AppealStatus.APPROVED]: 'Được chấp nhận',
  [AppealStatus.REJECTED]: 'Bị từ chối',
};

