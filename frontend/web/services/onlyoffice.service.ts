/**
 * OnlyOffice Integration Service
 * Handles all OnlyOffice-related API calls using direct fetch (same pattern as document.service.ts).
 * - Edit lock acquisition/release
 * - Editor configuration retrieval
 * - Conflict status checking
 * - Version diff computation
 * - Conflict resolution
 * - Version deletion
 */

const API_URL =
  typeof window === 'undefined'
    ? 'http://knowledge-service:8083'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// File types supported by OnlyOffice editing
export const EDITABLE_FILE_TYPES = ['DOCX', 'DOC', 'TXT', 'MD'];
export const VIEW_ONLY_FILE_TYPES = ['PDF', 'PNG', 'JPG', 'JPEG', 'XLSX', 'XLS'];

export function isEditableFileType(fileType: string): boolean {
  return EDITABLE_FILE_TYPES.includes(fileType.toUpperCase());
}

export function isViewOnlyFileType(fileType: string): boolean {
  return VIEW_ONLY_FILE_TYPES.includes(fileType.toUpperCase());
}

export interface LockInfo {
  documentId: string;
  lockedBy: string;
  lockedByUsername: string;
  versionAtLock: number;
  lockToken: string;
  lockedAt: string;
  expiresAt: string;
}

export interface ConflictStatus {
  hasConflict: boolean;
  hasConflictFile: boolean;
  documentId: string;
  lockedVersion: number;
  currentVersion: number;
  lockedBy: string;
  lockedByUsername: string;
  message: string;
  diffInfo: {
    baseContent: string;
    theirContent: string;
    theirChangelog: string;
    theirCreatedAt: string;
    theirCreatedByUsername: string;
  } | null;
}

export type DiffLine = {
  type: 'UNCHANGED' | 'ADDED' | 'DELETED';
  lineNumber: number;
  content: string;
};

export interface VersionDiff {
  documentId: string;
  baseVersion: number;
  compareVersion: number;
  baseContent: string;
  compareContent: string;
  lines: Array<{
    type: 'UNCHANGED' | 'ADDED' | 'DELETED';
    lineNumber: number;
    content: string;
  }>;
  additions: number;
  deletions: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error((err as { message?: string }).message || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const onlyOfficeService = {
  /**
   * Acquire an edit lock for a document.
   * Fails if the document is already locked by another user.
   * @param targetVersion if provided, lock against a specific version (for editing old versions).
   */
  async acquireLock(documentId: string, targetVersion?: number): Promise<LockInfo> {
    const params = targetVersion ? `?targetVersion=${targetVersion}` : '';
    const res = await apiFetch<LockInfo>(`/api/v1/documents/${documentId}/lock${params}`, {
      method: 'POST',
    });
    return res;
  },

  /**
   * Release an edit lock.
   */
  async releaseLock(documentId: string, lockToken: string): Promise<void> {
    await apiFetch<void>(`/api/v1/documents/${documentId}/lock?lockToken=${encodeURIComponent(lockToken)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get editor configuration for OnlyOffice iframe.
   * Returns the JWT-signed config JSON from knowledge-service.
   * Note: backend returns the config directly (not wrapped in { data: ... }).
   * @param targetVersion if provided, serve a specific version's file (frontend provides blob URL).
   */
  async getEditorConfig(documentId: string, targetVersion?: number): Promise<Record<string, unknown>> {
    const params = targetVersion ? `?targetVersion=${targetVersion}` : '';
    return await apiFetch<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/editor-config${params}`
    );
  },

  /**
   * Get current conflict status for a locked document.
   */
  async getConflictStatus(documentId: string): Promise<ConflictStatus> {
    const res = await apiFetch<ConflictStatus>(
      `/api/v1/documents/${documentId}/conflict-status`
    );
    return res;
  },

  /**
   * Check if a document still has an active lock (null = no lock = save succeeded).
   */
  async getLockStatus(documentId: string): Promise<{ locked: boolean } | null> {
    const res = await apiFetch<LockInfo | { locked: false }>(
      `/api/v1/documents/${documentId}/lock`
    );
    if ('locked' in res && res.locked === false) {
      return { locked: false };
    }
    return { locked: true };
  },

  /**
   * Get line-by-line diff between two versions.
   */
  async getVersionDiff(
    documentId: string,
    baseVersion: number,
    compareVersion: number
  ): Promise<VersionDiff> {
    const params = new URLSearchParams({
      baseVersion: String(baseVersion),
      compareVersion: String(compareVersion),
    });
    const res = await apiFetch<VersionDiff>(
      `/api/v1/documents/${documentId}/versions/diff?${params.toString()}`
    );
    return res;
  },

  /**
   * Resolve a conflict using one of three strategies.
   * - "merge_as_new": Upload merged file as a new version (requires file)
   * - "discard_mine": Discard my changes (keep their version)
   * - "force_push": Overwrite latest version (ADMIN only, requires file)
   */
  async resolveConflict(
    documentId: string,
    strategy: 'merge_as_new' | 'discard_mine' | 'force_push',
    lockToken: string,
    mergedChangelog?: string,
    file?: File
  ): Promise<{
    message: string;
    resolved: boolean;
    newVersion?: number;
    newVersionId?: string;
  }> {
    const formData = new FormData();
    formData.append('strategy', strategy);
    formData.append('lockToken', lockToken);
    if (mergedChangelog) {
      formData.append('mergedChangelog', mergedChangelog);
    }
    if (file) {
      formData.append('file', file);
    }

    const token = localStorage.getItem('accessToken');
    const res = await fetch(
      `${API_URL}/api/v1/documents/${documentId}/resolve-conflict`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Resolution failed' }));
      throw new Error((err as { message?: string }).message || `Resolution failed: ${res.status}`);
    }

    return res.json();
  },

  /**
   * Force-push a new version (ADMIN only shortcut).
   */
  async forcePush(
    documentId: string,
    file: File,
    changelog?: string
  ): Promise<{ newVersion: number; newVersionId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (changelog) {
      formData.append('changelog', changelog);
    }

    const token = localStorage.getItem('accessToken');
    const res = await fetch(
      `${API_URL}/api/v1/documents/${documentId}/force-push`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Force push failed' }));
      throw new Error((err as { message?: string }).message || `Force push failed: ${res.status}`);
    }

    return res.json();
  },

  /**
   * Download the conflict file (user's edited draft) stored in MinIO.
   * During a forcesave callback with version conflict, the backend saves the user's
   * edited content to MinIO at locks/{documentId}/conflict.{ext}.
   * The /file endpoint serves this conflict file when it exists.
   * Returns a File object or null if the download fails.
   */
  async downloadConflictFile(documentId: string, filename: string): Promise<File | null> {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${API_URL}/api/v1/documents/${documentId}/file`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    } catch {
      return null;
    }
  },

  /**
   * Download a specific version's file as a Blob.
   * Used by ConflictResolver to fetch the locked version file directly from backend.
   */
  async downloadVersionFile(documentId: string, versionNumber: number): Promise<Blob> {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(
      `${API_URL}/api/v1/documents/${documentId}/versions/${versionNumber}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },

  /**
   * Delete a specific version (ADMIN only).
   * Cannot delete the latest version or the only version.
   */
  async deleteVersion(
    documentId: string,
    versionNumber: number,
    reason?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (reason) params.append('reason', reason);

    await apiFetch<void>(
      `/api/v1/documents/${documentId}/versions/${versionNumber}?${params.toString()}`,
      { method: 'DELETE' }
    );
  },

  /**
   * Save the current editor content as a new document version.
   * Calls the backend which detects conflicts and creates a new version on success.
   * Throws ConflictError on 409 with conflict details.
   */
  async saveDocument(documentId: string, fileBlob: Blob): Promise<number> {
    const formData = new FormData();
    formData.append('file', fileBlob);
    const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/save`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });
    if (res.status === 409) {
      const err = await res.json().catch(() => ({})) as {
        message?: string;
        lockedVersion?: number;
        currentVersion?: number;
      };
      const error = new Error(err.message || 'Version conflict detected') as Error & {
        lockedVersion?: number;
        currentVersion?: number;
      };
      error.lockedVersion = err.lockedVersion;
      error.currentVersion = err.currentVersion;
      throw error;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string };
      throw new Error(err.message || `Save failed: ${res.status}`);
    }
    const data = await res.json() as { newVersion: number };
    return data.newVersion;
  },

  /**
   * Fetch the latest version metadata for a document.
   */
  async fetchLatestVersion(documentId: string): Promise<{ versionNumber: number; versionId: string }> {
    return await apiFetch<{ versionNumber: number; versionId: string }>(
      `/api/v1/documents/${documentId}/fetch-latest`
    );
  },

  /**
   * Trigger a server-side forcesave via OnlyOffice Command Service.
   * The backend sends a forcesave command to OnlyOffice DS, which triggers
   * a callback (status=6) to save the document as a new version.
   * Returns immediately with whether the command was accepted.
   * Frontend should poll getLockStatus() to detect when the save completes.
   */
  async triggerSave(documentId: string): Promise<TriggerSaveResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const traceId = typeof window !== 'undefined' ? localStorage.getItem('traceId') : null;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (traceId) headers['x-trace-id'] = traceId;

    const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/trigger-save`, {
      method: 'POST',
      headers,
    });

    if (res.status === 409) {
      const data = await res.json().catch(() => ({})) as TriggerSaveResponse;
      return { 
        accepted: false, 
        hasConflict: true, 
        message: data.message || 'Version conflict detected', 
        lockedVersion: data.lockedVersion ?? 0, 
        currentVersion: data.currentVersion ?? 0 
      };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string };
      throw new Error(err.message || `Trigger save failed: ${res.status}`);
    }

    return res.json() as Promise<TriggerSaveResponse>;
  },

  /**
   * Re-open the editor for merge after conflict without re-acquiring lock.
   * Uses the existing lock token and serves a specific version.
   */
  async reOpenForMerge(
    documentId: string,
    lockToken: string,
    targetVersion: number
  ): Promise<ReOpenResponse> {
    const params = new URLSearchParams({
      lockToken,
      targetVersion: String(targetVersion),
    });
    return await apiFetch<ReOpenResponse>(
      `/api/v1/documents/${documentId}/re-edit?${params.toString()}`,
      { method: 'POST' }
    );
  },

  /**
   * Relock a document for merge/re-edit during conflict resolution.
   * Releases the old lock and acquires a new one against the latest version.
   * Returns lock info + editor config for immediate re-opening.
   */
  async relockForMerge(documentId: string): Promise<RelockResponse> {
    return await apiFetch<RelockResponse>(
      `/api/v1/documents/${documentId}/relock`,
      { method: 'POST' }
    );
  },

  /**
   * Get the OnlyOffice Document Server URL for embedding.
   */
  getDocumentServerUrl(): string {
    return process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'http://localhost:8888';
  },
};

export interface TriggerSaveResponse {
  accepted: boolean;
  hasConflict: boolean;
  message: string;
  lockedVersion: number;
  currentVersion: number;
}

export interface RelockResponse {
  lock: LockInfo;
  editorConfig: Record<string, unknown>;
  currentVersion: number;
}

export interface ReOpenResponse {
  document: {
    title: string;
    fileType: string;
    url: string;
    key: string;
  };
  documentType: string;
  editorConfig: Record<string, unknown>;
  token: string;
  type: string;
  targetVersion: number;
  lock: LockInfo;
  currentVersion: number;
}
