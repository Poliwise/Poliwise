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
   */
  async getEditorConfig(documentId: string): Promise<Record<string, unknown>> {
    return await apiFetch<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/editor-config`
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
   * Get the OnlyOffice Document Server URL for embedding.
   */
  getDocumentServerUrl(): string {
    return process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'http://localhost:8888';
  },
};
