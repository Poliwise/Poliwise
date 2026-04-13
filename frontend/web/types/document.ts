// Document Types
export interface Document {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  fileType: FileType;
  status: DocumentStatus;
  department?: string;
  departmentName?: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
  effectiveDate?: string;
  expireDate?: string;
  version: number;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt: string;
  updatedAt: string;
  processedAt?: string;
}

export enum FileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  XLSX = 'XLSX',
  PNG = 'PNG',
  JPG = 'JPG',
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  EXPIRED = 'EXPIRED',
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  fileName: string;
  fileSize: number;
  fileType: FileType;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt: string;
  changesDescription?: string;
}

export interface UploadDocumentRequest {
  file: File;
  title: string;
  description?: string;
  department?: string;
  category?: string;
  tags?: string[];
  effectiveDate?: string;
  expireDate?: string;
}

export interface DocumentUploadResponse {
  id: string;
  originalFilename: string;
  fileType: string;
  fileSizeBytes: number;
  mimeType: string;
  status: string;
  currentVersion: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  // AI suggestion fields (Phase 1)
  suggestedLanguage: string | null;
  suggestedCategorySlug: string | null;
  suggestedTitle: string | null;
  suggestedDescription: string | null;
  suggestedTags: string[];
  suggestedIsPolicy: boolean | null;
}

export interface DocumentSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentStatus;
  department?: string;
  category?: string;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Metadata Types
export interface DocumentMetadata {
  id: string;
  documentId: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  effectiveDate?: string;
  expireDate?: string;
  status: DocumentStatus;
  accessLevel: AccessLevel;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

export enum AccessLevel {
  PUBLIC = 'PUBLIC',
  DEPARTMENT_ONLY = 'DEPARTMENT_ONLY',
  RESTRICTED = 'RESTRICTED',
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  usageCount?: number;
}

export interface AccessRule {
  id: string;
  documentId: string;
  accessLevel: AccessLevel;
  allowedRoles?: string[];
  allowedDepartments?: string[];
  createdAt: string;
}
