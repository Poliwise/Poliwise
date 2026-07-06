'use client';

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { AlertTriangle, Lock, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import mammoth from 'mammoth';
import { onlyOfficeService, type LockInfo } from '@/services/onlyoffice.service';
import { Button } from '@/components/ui/button/Button';
import { Modal } from '@/components/ui/modal/Modal';

const OO_DEBUG = process.env.NEXT_PUBLIC_ONLYOFFICE_DEBUG === 'true';

function ooLog(...args: any[]) {
  if (!OO_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log('[OnlyOffice][debug]', ...args);
}

function ooWarn(...args: any[]) {
  if (!OO_DEBUG) return;
  // eslint-disable-next-line no-console
  console.warn('[OnlyOffice][debug]', ...args);
}

export interface OnlyOfficeEditorHandle {
  downloadCurrentFile: () => Promise<File | null>;
}

type DiffLine = {
  type: 'UNCHANGED' | 'ADDED' | 'DELETED';
  lineNumber: number;
  content: string;
};

export interface OnlyOfficeEditorProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  fileType: string;
  currentVersion: number;
  /** If provided, lock and edit this specific version (for editing old versions). */
  targetVersion?: number;
  /** If provided, show a diff side panel (merge mode from conflict resolution). */
  mergeDiffData?: {
    diffLines: DiffLine[];
    baseVersion: number;
    currentVersion: number;
  };
  /**
   * When non-null, the editor loads this file blob (from a prior OnlyOffice session)
   * instead of fetching from the backend. Used for re-edit after conflict — the user
   * keeps editing the same file while optionally previewing the latest version.
   */
  currentFile?: File | null;
  /**
   * When non-null, show a side panel with a mammoth-rendered preview of the latest
   * version. Used for re-edit after conflict — user sees the latest version while
   * editing their current file.
   */
  latestVersionPreview?: {
    versionNumber: number;
  } | null;
  onSaveSuccess?: (newVersion: number) => void;
  /**
   * Called when conflict is detected. Triggers ConflictResolver automatically.
   * ConflictResolver fetches the locked version file directly from the backend.
   */
  onConflictDetected?: (conflictData: {
    lock: LockInfo;
    currentVersion: number;
    currentFile: File | null;
  }) => void;
  /**
   * When true, the editor is kept alive in the background while ConflictResolver
   * is shown. The cleanup effect will NOT release the lock in this state —
   * the lock stays held until ConflictResolver resolves or the user closes it.
   */
  conflictResolverActive?: boolean;
}

type EditorState =
  | 'acquiring_lock'
  | 'loading_config'
  | 'editing'
  | 'saving'
  | 'saved'
  | 'error';

const OnlyOfficeEditorComponent = forwardRef<OnlyOfficeEditorHandle, OnlyOfficeEditorProps>(function OnlyOfficeEditorComponent(
  {
    open,
    onClose,
    documentId,
    documentTitle,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fileType: _fileType,
    currentVersion,
    targetVersion,
    mergeDiffData,
    currentFile,
    latestVersionPreview,
    onSaveSuccess,
    onConflictDetected,
    conflictResolverActive,
  }: OnlyOfficeEditorProps,
  ref
) {
  const [diffPanelOpen, setDiffPanelOpen] = useState(!!mergeDiffData);
  const isMergeMode = !!(mergeDiffData || latestVersionPreview);
  const [latestPreview, setLatestPreview] = useState<{
    loading: boolean;
    html: string | null;
    error: string | null;
  }>({ loading: false, html: null, error: null });
  const editorDivRef = useRef<HTMLDivElement>(null);
  // Guard so the SDK-init effect doesn't re-run when editorReady changes
  const editorInitRef = useRef(false);

  // Stable container ID derived from documentId — deterministic across SSR and
  // hydration, so there is no React error #418 (hydration mismatch).
  // The server renders:  <div id="onlyoffice-doc-{documentId}">
  // The client hydrates: <div id="onlyoffice-doc-{documentId}">  ← identical
  const editorContainerId = `onlyoffice-doc-${documentId}`;

  const [state, setState] = useState<EditorState>('acquiring_lock');
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<LockInfo | null>(null);
  const [editorConfig, setEditorConfig] = useState<Record<string, unknown> | null>(null);
  // Store the DocsAPI instance in a ref so destroyEditor() can be called synchronously
  // without triggering the "setState in effect" lint error.
  const docsEditorInstanceRef = useRef<unknown>(null);
  // Ref to track the lock-refresh interval so it can be cleared in cleanup
  // without causing the init effect to re-run (which would cause infinite loops
  // because the effect depends on lock via setLock(refreshed)).
  const lockRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref that tracks whether a save is in-flight.  This is checked inside the
  // destroy effect (which has stale closure over `state`) to prevent the SDK
  // from being destroyed while a save is still being processed.
  const saveInProgressRef = useRef(false);
  // Ref to track save button element for DOM-only spinner (avoids React re-renders).
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  // Original save button text/icon for restoration after save.
  const saveButtonOriginalHTML = useRef<string>('');
  // Ref for success toast element
  const successToastRef = useRef<HTMLDivElement | null>(null);
  // Manage blob URL lifecycle for currentFile prop
  const blobUrlRef = useRef<string | null>(null);
  // Track conflictResolverActive synchronously so cleanup effect sees the latest value
  // (prevents race condition where React state hasn't updated yet)
  const conflictResolverActiveRef = useRef(conflictResolverActive);
  useEffect(() => { conflictResolverActiveRef.current = conflictResolverActive; }, [conflictResolverActive]);

  // Restore save button after save completes/cancels/error.
  const restoreSaveButton = useCallback(() => {
    if (saveButtonRef.current && saveButtonOriginalHTML.current) {
      saveButtonRef.current.disabled = false;
      saveButtonRef.current.innerHTML = saveButtonOriginalHTML.current;
    }
  }, []);

  // Show save success toast via DOM manipulation — avoids React re-renders.
  const showSaveSuccessToast = useCallback(() => {
    // Create toast if it doesn't exist
    let toast = successToastRef.current;
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'onlyoffice-save-success-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(toast);
      successToastRef.current = toast;
    }
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="10" fill="#059669"/>
        <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Đã lưu thành công! Đóng cửa sổ để tiếp tục.
    `;
    toast.style.display = 'flex';
  }, []);

  // Keep a ref to the current lock so cleanup functions (which can't have
  // lock in their deps without causing infinite effect loops) always see the latest value.
  const lockRef = useRef<LockInfo | null>(null);
  useEffect(() => { lockRef.current = lock; }, [lock]);

  // Track if component is still mounted in DOM.  Set to false when React
  // starts unmounting (cleanup effect), so the destroy effect knows not to
  // touch SDK internals that React has already detached.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Expose downloadCurrentFile() via ref so parent can grab the current editor content
  // without coupling to the internal SDK instance.
  useImperativeHandle(ref, () => ({
    downloadCurrentFile: async (): Promise<File | null> => {
      const instance = docsEditorInstanceRef.current as {
        downloadAs: (opts: Record<string, unknown>) => Promise<Blob>;
      } | null;
      if (!instance) return null;
      try {
        const blob = await instance.downloadAs({ target: 'blob' });
        const ext = ((editorConfig as { document?: { fileType?: string } })?.document?.fileType ?? 'docx').toLowerCase();
        const safeName = documentTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9.-]/g, '_');
        const filename = `${safeName}.${ext}`;
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      } catch {
        return null;
      }
    },
  }), [documentTitle, editorConfig]);

  // Destroy the OnlyOffice SDK editor synchronously (outside React rendering) when
  // we are about to leave the 'editing' state.  This runs BEFORE React removes
  // the container div from the DOM, so the SDK does not call removeChild() on a
  // node that React already detached (which causes NotFoundError).
  //
  // Guard: do NOT destroy while a save is in-flight (saveInProgressRef) OR
  // while the save state is pending a poll result.  This prevents the destroy
  // from firing during the state→'saving' transition while the SDK is still
  // finishing up (e.g., the iframe is still mounted but the SDK has started
  // its own cleanup after the forcesave callback).
  useEffect(() => {
    if (saveInProgressRef.current) {
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    if (state === 'saving' || state === 'saved') {
      return;
    }
    const instance = docsEditorInstanceRef.current as {
      destroyEditor?: (cmd: Record<string, unknown>) => void;
    } | null;
    if (instance?.destroyEditor && state !== 'editing') {
      const container = document.getElementById(editorContainerId);
      if (!container) {
        return;
      }
      instance.destroyEditor({ forbidLaunchBrowser: false });
      const iframe = container?.querySelector('iframe');
      if (iframe?.parentElement) {
        iframe.parentElement.removeChild(iframe);
      }
    }
  }, [state, editorContainerId]);

  const clearIntervals = useCallback(() => {
    if (lockRefreshIntervalRef.current) {
      clearInterval(lockRefreshIntervalRef.current);
      lockRefreshIntervalRef.current = null;
    }
    if (savePollIntervalRef.current) {
      clearInterval(savePollIntervalRef.current);
      savePollIntervalRef.current = null;
    }
  }, []);

  // Reset editor state (without closing the modal) — used by the Retry button.
  const resetEditorState = useCallback(() => {
    editorInitRef.current = false;
    docsEditorInstanceRef.current = null;
    setEditorConfig(null);
    setError(null);
    setState('acquiring_lock');
  }, []);

  const cleanup = useCallback((options: { releaseLock?: boolean } = {}) => {
    clearIntervals();
    // Only release lock if explicitly requested AND lock exists.
    // After a successful save, the backend already released the lock.
    if (options.releaseLock !== false && lock) {
      onlyOfficeService.releaseLock(documentId, lock.lockToken).catch(() => {});
    }
    setLock(null);
    editorInitRef.current = false;
    setError(null);
  }, [lock, documentId, clearIntervals]);

  const handleClose = useCallback(() => {
    // If save just completed (saveInProgressRef was set to false), the backend
    // already released the lock. We should NOT try to release it again (would 403).
    const wasSaving = saveInProgressRef.current;
    saveInProgressRef.current = false;
    cleanup({ releaseLock: !wasSaving });
    onClose();
  }, [cleanup, onClose]);

  // Ref to track save polling interval so it can be cleared on component unmount.
  const savePollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll lock status until the lock is released (indicating save completed)
  // or until a conflict is detected.
  const startSavePoll = useCallback((
    docId: string,
    onSuccess: (newVersion: number) => void,
  ): void => {
    const MAX_POLLS = 30;
    let pollCount = 0;

    savePollIntervalRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        clearInterval(savePollIntervalRef.current!);
        savePollIntervalRef.current = null;
        saveInProgressRef.current = false;
        restoreSaveButton();
        setError('Hết thời gian chờ lưu. Vui lòng thử lại.');
        return;
      }

      try {
        const status = await onlyOfficeService.getConflictStatus(docId);
        
        // Case 1: No active lock found -> successful save!
        if (!status.hasConflict && status.message === 'No active lock') {
          clearInterval(savePollIntervalRef.current!);
          savePollIntervalRef.current = null;
          saveInProgressRef.current = false;
          restoreSaveButton();
          showSaveSuccessToast();
          onSuccess(status.currentVersion);
          return;
        }

        // Case 1b: No conflict and no active lock -> also successful save
        // (getConflictStatus returns "No conflict" when the lock was already released by backend)
        if (!status.hasConflict && (status.message === 'No conflict' || status.message === 'No active lock')) {
          clearInterval(savePollIntervalRef.current!);
          savePollIntervalRef.current = null;
          saveInProgressRef.current = false;
          restoreSaveButton();
          showSaveSuccessToast();
          onSuccess(status.currentVersion);
          return;
        }

        // Case 2: Conflict detected AND conflict file has been successfully uploaded to MinIO!
        if (status.hasConflict && status.hasConflictFile) {
          clearInterval(savePollIntervalRef.current!);
          savePollIntervalRef.current = null;

          const currentLock = lockRef.current;

          // Download the user's edited content (draft / old-2) from the backend.
          // The backend saved this file to MinIO during the forcesave callback
          // when it detected a version conflict. We download it now so that
          // ConflictResolver can preview it and the re-edit flow can load it.
          let conflictDraftFile: File | null = null;
          try {
            conflictDraftFile = await onlyOfficeService.downloadConflictFile(
              docId,
              `conflict_draft.docx`
            );
          } catch {
            // If download fails, ConflictResolver will show "no content" —
            // user can still discard or re-edit.
          }

          // Destroy SDK safely
          editorInitRef.current = false;
          const instance = docsEditorInstanceRef.current as {
            destroyEditor?: (cmd: Record<string, unknown>) => void;
          } | null;
          if (instance?.destroyEditor) {
            try { instance.destroyEditor({ forbidLaunchBrowser: false }); } catch {}
            docsEditorInstanceRef.current = null;
          }
          const container = document.getElementById(editorContainerId);
          const iframe = container?.querySelector('iframe');
          if (iframe?.parentElement) {
            try { iframe.parentElement.removeChild(iframe); } catch {}
          }

          saveInProgressRef.current = false;
          restoreSaveButton();

          if (onConflictDetected && currentLock) {
            // SYNCHRONOUSLY prevent cleanup from releasing the lock.
            // React will unmount this component immediately after onConflictDetected updates state,
            // so we must set this ref now before the cleanup effect runs.
            conflictResolverActiveRef.current = true;
            onConflictDetected({
              lock: currentLock,
              currentVersion: status.currentVersion,
              currentFile: conflictDraftFile,
            });
          }
          return;
        }
      } catch {
        // still polling
      }
    }, 2000);
  }, [restoreSaveButton, showSaveSuccessToast, editorContainerId, onConflictDetected]);

  const stopSavePoll = useCallback((): void => {
    if (savePollIntervalRef.current !== null) {
      clearInterval(savePollIntervalRef.current);
      savePollIntervalRef.current = null;
    }
  }, []);

  // Load latest version preview using mammoth
  const loadLatestPreview = useCallback(async (versionNumber: number) => {
    setLatestPreview({ loading: true, html: null, error: null });
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/documents/${documentId}/versions/${versionNumber}/download`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const { value } = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
          ],
        }
      );
      setLatestPreview({ loading: false, html: value, error: null });
    } catch {
      setLatestPreview({ loading: false, html: null, error: 'Không thể tải nội dung.' });
    }
  }, [documentId]);

  // Auto-load preview when panel opens
  const prevLatestPreviewOpen = useRef(false);
  useEffect(() => {
    if (diffPanelOpen && latestVersionPreview && !prevLatestPreviewOpen.current && !latestPreview.html && !latestPreview.loading) {
      loadLatestPreview(latestVersionPreview.versionNumber);
    }
    prevLatestPreviewOpen.current = diffPanelOpen;
  }, [diffPanelOpen, latestVersionPreview, loadLatestPreview, latestPreview.html, latestPreview.loading]);

  const handleSave = useCallback(async () => {
    if (state !== 'editing') return;

    if (saveButtonRef.current) {
      saveButtonOriginalHTML.current = saveButtonRef.current.innerHTML;
      saveButtonRef.current.disabled = true;
      saveButtonRef.current.innerHTML = `<svg class="w-4 h-4 mr-1 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Đang lưu...`;
    }

    try {
      // Trigger forcesave.
      const result = await onlyOfficeService.triggerSave(documentId);
      if (!result.accepted) {
        if (result.message === 'Tài liệu không có thay đổi nào mới để lưu.' && currentFile && lockRef.current) {
          // If OnlyOffice reports no changes (error=4), but the user is currently looking at
          // their conflict draft (old-2) and hit Save, we should promote the conflict file to a new version.
          try {
            const saveRes = await onlyOfficeService.resolveConflict(
              documentId,
              'merge_as_new',
              lockRef.current.lockToken
            );
            saveInProgressRef.current = false;
            restoreSaveButton();
            showSaveSuccessToast();
            onSaveSuccess?.(saveRes.newVersion || currentVersion + 1);
            return;
          } catch (resErr) {
            restoreSaveButton();
            setError('Lưu thất bại: ' + (resErr instanceof Error ? resErr.message : 'Lỗi không xác định'));
            return;
          }
        }
        restoreSaveButton();
        setError(result.message || 'Lưu thất bại. Vui lòng thử lại.');
        return;
      }

      saveInProgressRef.current = true;
      startSavePoll(
        documentId,
        (newVersion) => {
          onSaveSuccess?.(newVersion);
        }
      );

    } catch (err) {
      console.error('[OnlyOffice] handleSave error:', err);
      stopSavePoll();
      restoreSaveButton();
      const msg = err instanceof Error ? err.message : 'Lưu thất bại';
      setError(msg);
    }
  }, [state, documentId, onSaveSuccess, restoreSaveButton, startSavePoll]);

  // Acquire lock + load editor config on open
  useEffect(() => {
    if (!open) return;

    const init = async () => {
      try {
        setState('acquiring_lock');

        let config: Record<string, unknown>;
        let lockInfo: LockInfo | null = null;

        if (currentFile) {
          ooLog('init: re-edit with currentFile', {
            documentId,
            targetVersion,
            currentVersion,
            filename: currentFile.name,
            size: currentFile.size,
            type: currentFile.type,
          });
          // Re-edit after conflict: we already have the user's in-progress file blob.
          // We still need to hold/refresh the same lock, otherwise OnlyOffice will open
          // read-only or the backend may reject callbacks.
          lockInfo = await onlyOfficeService.acquireLock(documentId, targetVersion);
          ooLog('init: acquired lock (re-edit)', {
            lockToken: lockInfo.lockToken,
            versionAtLock: lockInfo.versionAtLock,
            expiresAt: lockInfo.expiresAt,
          });
          setLock(lockInfo);
          config = await onlyOfficeService.getEditorConfig(documentId, targetVersion);
        } else {
          ooLog('init: normal edit (no currentFile)', { documentId, targetVersion, currentVersion });
          lockInfo = await onlyOfficeService.acquireLock(documentId, targetVersion);
          ooLog('init: acquired lock', {
            lockToken: lockInfo.lockToken,
            versionAtLock: lockInfo.versionAtLock,
            expiresAt: lockInfo.expiresAt,
          });
          setLock(lockInfo);
          config = await onlyOfficeService.getEditorConfig(documentId, targetVersion);
        }

        ooLog('init: got editor config', {
          hasDocument: !!(config as any)?.document,
          fileType: (config as any)?.document?.fileType,
          url: (config as any)?.document?.url,
          key: (config as any)?.document?.key,
          editorType: (config as any)?.editorConfig?.mode,
        });

        // If we have a file blob, do NOT override the config's URL with a frontend blob URL.
        // OnlyOffice Document Server runs on a server and cannot read browser-local blob URLs.
        // Instead, the backend is smart enough to serve the conflict/target file snapshot
        // when OnlyOffice requests the backend's /file proxy URL.
        if (currentFile) {
          ooLog('init: re-edit detected, using backend-served config.document.url instead of local blob');
          if (lockInfo) setLock(lockInfo);
        }

        setState('loading_config');
        setEditorConfig(config);

        // Refresh lock every 5 min if we have a lock
        if (lockInfo) {
          const interval = setInterval(async () => {
            try {
              const refreshed = await onlyOfficeService.acquireLock(documentId, targetVersion);
              setLock(refreshed);
            } catch {
              setError('Phiên chỉnh sửa đã hết hạn. Vui lòng đóng và mở lại editor.');
            }
          }, 5 * 60 * 1000);
          lockRefreshIntervalRef.current = interval;
        }

        setState('editing');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể mở editor';
        setError(msg);
        setState('error');
      }
    };

    init();

    return () => {
      clearIntervals();
      // Use ref for synchronous access (avoids React state race condition).
      // When onConflictDetected sets conflictResolverActive=true, the cleanup effect
      // will see the updated ref value and skip lock release + blob revocation.
      if (!saveInProgressRef.current && !conflictResolverActiveRef.current) {
        if (lockRef.current) {
          onlyOfficeService.releaseLock(documentId, lockRef.current.lockToken).catch(() => {});
        }
        setLock(null);
        editorInitRef.current = false;
        setState('acquiring_lock');
        setError(null);
      }
      // Revoke blob URL only when NOT going to conflict resolution.
      // When conflictResolverActive=true, the parent holds currentFile (File object)
      // and will re-open the editor with it. We must NOT revoke the blob URL
      // because ConflictResolver may still reference it during re-edit.
      if (!conflictResolverActiveRef.current && blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [open, documentId, targetVersion, clearIntervals, currentFile]);

  // Listen for messages from OnlyOffice iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const ooUrl = onlyOfficeService.getDocumentServerUrl();
      const allowedOrigin = ooUrl.replace(/^http/, 'http');
      if (!event.origin.startsWith(allowedOrigin.replace(/\/$/, ''))) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Guard: if the editor was already destroyed (e.g., during conflict resolution),
      // skip all message handling to prevent SDK from trying DOM operations on a dead editor.
      if (!editorInitRef.current) return;

      // Capture current lock from a ref so we don't need lock as a dep
      // (which would re-add the listener on every lock refresh).
      const currentLock = lockRef.current;

      // Wrap all SDK message handling in try/catch. NotFoundError from SDK's internal
      // event handlers is suppressed silently — it doesn't affect user-facing behavior.
      try {
        switch (data.type) {
          case 'onlyoffice_ready': {
            break;
          }
          case 'onlyoffice_save_as': {
            // Fires when user clicks "Save As" inside the OnlyOffice editor.
            if (saveButtonRef.current) {
              saveButtonOriginalHTML.current = saveButtonRef.current.innerHTML;
              saveButtonRef.current.disabled = true;
              saveButtonRef.current.innerHTML = `<svg class="w-4 h-4 mr-1 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Đang lưu...`;
            }

            try {
              // Trigger forcesave.
              const result = await onlyOfficeService.triggerSave(documentId);
              if (!result.accepted) {
                saveInProgressRef.current = false;
                restoreSaveButton();
                setError(result.message || 'Lưu thất bại.');
                break;
              }
              saveInProgressRef.current = true;
              startSavePoll(
                documentId,
                () => {
                  onSaveSuccess?.(0);
                }
              );
            } catch (err) {
              console.error('[OnlyOffice] save_as failed:', err);
              saveInProgressRef.current = false;
              restoreSaveButton();
              const msg = err instanceof Error ? err.message : 'Lưu thất bại';
              setError(msg);
            }
            break;
          }
          case 'onDocumentStateChange': {
            if (data.data === 0 && !saveInProgressRef.current) {
              if (docsEditorInstanceRef.current) {
                handleClose();
              }
            }
            break;
          }
          case 'onConflictDetected': {
            // SDK reports a conflict — capture file, destroy, notify parent.
            // IMPORTANT: capture must happen BEFORE we destroy the SDK instance,
            // otherwise downloadAs() will return null and user loses in-progress edits.
            ooWarn('event: onConflictDetected received', {
              documentId,
              targetVersion,
              currentVersion,
              hasLock: !!currentLock,
              lockToken: currentLock?.lockToken,
              versionAtLock: currentLock?.versionAtLock,
            });

            editorInitRef.current = false;

            let capturedFile: File | null = null;
            try {
              const instance = docsEditorInstanceRef.current as {
                downloadAs: (opts: Record<string, unknown>) => Promise<Blob>;
              } | null;
              ooLog('conflict: docsEditorInstanceRef.current', {
                exists: !!instance,
                hasDownloadAs: !!(instance as any)?.downloadAs,
              });

              if (instance?.downloadAs) {
                const t0 = performance.now();
                const blob = await instance.downloadAs({ target: 'blob' });
                const ms = Math.round(performance.now() - t0);

                const ext = ((editorConfig as { document?: { fileType?: string } })?.document?.fileType ?? 'docx').toLowerCase();
                const safeName = documentTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9.-]/g, '_');
                const filename = `${safeName}.${ext}`;
                capturedFile = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

                ooLog('conflict: downloadAs(blob) ok', {
                  tookMs: ms,
                  blobSize: blob.size,
                  blobType: blob.type,
                  filename,
                });
              } else {
                ooWarn('conflict: downloadAs not available on instance');
              }
            } catch (e) {
              ooWarn('conflict: downloadAs(blob) failed', {
                error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e,
              });
              capturedFile = null;
            }

            const instance = docsEditorInstanceRef.current as {
              destroyEditor?: (cmd: Record<string, unknown>) => void;
            } | null;
            if (instance?.destroyEditor) {
              try {
                ooLog('conflict: destroyEditor()');
                instance.destroyEditor({ forbidLaunchBrowser: false });
              } catch (e) {
                ooWarn('conflict: destroyEditor failed', {
                  error: e instanceof Error ? { name: e.name, message: e.message } : e,
                });
              }
              docsEditorInstanceRef.current = null;
            }
            const container = document.getElementById(editorContainerId);
            const iframe = container?.querySelector('iframe');
            if (iframe?.parentElement) {
              try {
                ooLog('conflict: removing iframe');
                iframe.parentElement.removeChild(iframe);
              } catch (e) {
                ooWarn('conflict: remove iframe failed', {
                  error: e instanceof Error ? { name: e.name, message: e.message } : e,
                });
              }
            }

            if (onConflictDetected && currentLock) {
              try {
                const status = await onlyOfficeService.getConflictStatus(documentId);
                ooLog('conflict: got conflict-status', {
                  lockedVersion: status.lockedVersion,
                  currentVersion: status.currentVersion,
                  hasConflictFile: status.hasConflictFile,
                });

                // If SDK downloadAs() failed but backend has the conflict file,
                // download it as a fallback so ConflictResolver has the user's draft.
                let fileToSend = capturedFile;
                if (!fileToSend && status.hasConflictFile) {
                  ooLog('conflict: capturedFile is null, downloading conflict file from backend');
                  try {
                    fileToSend = await onlyOfficeService.downloadConflictFile(
                      documentId,
                      `conflict_draft.docx`
                    );
                    ooLog('conflict: downloaded conflict file from backend', {
                      size: fileToSend?.size,
                    });
                  } catch {
                    ooWarn('conflict: failed to download conflict file from backend');
                  }
                }

                onConflictDetected({
                  lock: currentLock,
                  currentVersion: status.currentVersion,
                  currentFile: fileToSend,
                });
              } catch (e) {
                ooWarn('conflict: getConflictStatus failed', {
                  error: e instanceof Error ? { name: e.name, message: e.message } : e,
                });
                onConflictDetected({
                  lock: currentLock,
                  currentVersion: 0,
                  currentFile: capturedFile,
                });
              }
            } else {
              ooWarn('conflict: missing onConflictDetected or currentLock', {
                hasHandler: !!onConflictDetected,
                hasLock: !!currentLock,
              });
            }
            break;
          }
          case 'onSaved':
          case 'onSave': {
            break;
          }
          case 'onError': {
            setError('Lỗi OnlyOffice: ' + (data.data?.message || 'Lỗi không xác định'));
            setState('error');
            break;
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotFoundError') return;
        console.error('[OnlyOffice] handleMessage error:', e);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [documentId, currentVersion, onConflictDetected, handleClose, editorContainerId, restoreSaveButton, showSaveSuccessToast, startSavePoll]);

  // Inject OnlyOffice SDK script and initialize editor
  useEffect(() => {
    // Only init when in editing state and config is ready
    if (state !== 'editing' || !editorConfig || !editorDivRef.current) {
      return;
    }

    // Prevent re-initialization within the same mount cycle.
    if (editorInitRef.current) {
      return;
    }
    editorInitRef.current = true;

    const ooUrl = onlyOfficeService.getDocumentServerUrl();

    // If an old editor instance is still lurking in the DOM (e.g., from a
    // React StrictMode double-mount cycle), destroy it before creating a new one.
    // The SDK's internal iframe will be replaced by the new DocEditor call.
    const existingInstance = docsEditorInstanceRef.current as {
      destroyEditor?: (cmd: Record<string, unknown>) => void;
    } | null;
    if (existingInstance?.destroyEditor) {
      try {
        existingInstance.destroyEditor({ forbidLaunchBrowser: false });
      } catch {}
      docsEditorInstanceRef.current = null;
      // Remove any leftover iframe
      const oldContainer = document.getElementById(editorContainerId);
      const oldIframe = oldContainer?.querySelector('iframe');
      if (oldIframe?.parentElement) {
        try { oldIframe.parentElement.removeChild(oldIframe); } catch {}
      }
    }

    const script = document.createElement('script');
    script.src = `${ooUrl}/web-apps/apps/api/documents/api.js`;

    const onLoad = () => {
      // Guard: if component was unmounted (cleanup ran) while script was loading,
      // skip init entirely. The SDK must never touch a detached container.
      if (!isMountedRef.current) {
        editorInitRef.current = false;
        return;
      }

      // Guard: if state has changed away from 'editing' while the script was loading,
      // skip init and reset so the next state='editing' can retry.
      if (state !== 'editing') {
        editorInitRef.current = false;
        return;
      }

      // Guard: verify container is still present in the DOM before SDK touches it.
      // React may have re-rendered and replaced/moved the container element.
      if (!editorDivRef.current || !document.contains(editorDivRef.current)) {
        editorInitRef.current = false;
        return;
      }

      if (typeof window.DocsAPI === 'undefined' || !window.DocsAPI) {
        setError('Không thể tải OnlyOffice API');
        setState('error');
        return;
      }

      // Defer SDK init by one animation frame so React's render cycle fully
      // settles before we touch the container. This prevents the SDK's internal
      // insertBefore/moveChild calls from racing against React DOM updates.
      requestAnimationFrame(() => {
        // Double-check all guards inside rAF as state may have shifted again.
        if (!isMountedRef.current) return;
        if (state !== 'editing') return;
        if (!editorDivRef.current || !document.contains(editorDivRef.current)) return;
        if (typeof window.DocsAPI === 'undefined' || !window.DocsAPI) return;

        try {
          const config = editorConfig as {
            document: { title: string; fileType: string; url: string; key: string };
            documentType: string;
            editorConfig: { user: { id: string; name: string }; lang: string };
            token?: string;
          };

          const instance = new window.DocsAPI.DocEditor(editorContainerId, {
            document: { ...config.document },
            documentType: config.documentType,
            editorConfig: { ...config.editorConfig, mode: 'edit' },
            token: config.token,
            type: (editorConfig as Record<string, unknown>).type as string ?? 'desktop',
            permissions: {
              edit: true,
              download: true,
              print: false,
            },
            events: {
              onDocumentStateChange: (docState: number) => {
                window.parent.postMessage({ type: 'onDocumentStateChange', data: docState }, '*');
              },
              onDocumentReady: () => {
                window.parent.postMessage({ type: 'onlyoffice_ready' }, '*');
              },
              onSave: () => {
                window.parent.postMessage({ type: 'onSave' }, '*');
              },
              onRequestSaveAs: (data: { key: string; title: string; format: string }) => {
                window.parent.postMessage({ type: 'onlyoffice_save_as', ...data }, '*');
              },
              onError: (err: unknown) => {
                window.parent.postMessage({ type: 'onError', data: err }, '*');
              },
            },
          });

          docsEditorInstanceRef.current = instance;
          window.parent.postMessage({ type: 'onEditorReady', documentId }, '*');
        } catch (err) {
          setError('Không thể khởi tạo OnlyOffice: ' + (err instanceof Error ? err.message : String(err)));
          setState('error');
        }
      });
    };

    script.onload = onLoad;
    script.onerror = () => {
      editorInitRef.current = false;
      setError('Không thể tải OnlyOffice API script');
      setState('error');
    };

    document.head.appendChild(script);
  }, [state, editorConfig, editorContainerId, documentId]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isMergeMode ? `Chỉnh sửa hợp nhất: ${documentTitle}` : `Chỉnh sửa: ${documentTitle}`}
      size="full"
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border text-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Acquiring lock */}
            <div style={{ display: state !== 'acquiring_lock' ? 'none' : undefined }}>
              <Loader2 className="w-4 h-4 animate-spin text-info" />
              <span className="ml-1">Đang khóa tài liệu...</span>
            </div>
            {/* Loading config */}
            <div style={{ display: state !== 'loading_config' ? 'none' : undefined }}>
              <Loader2 className="w-4 h-4 animate-spin text-info" />
              <span className="ml-1">Đang tải cấu hình editor...</span>
            </div>
            {/* Editing */}
            <div style={{ display: state !== 'editing' ? 'none' : undefined }}>
              <Lock className="w-4 h-4 text-success" />
              <span className="ml-1 text-success-foreground font-medium">
                Đang chỉnh sửa (phiên bản v{targetVersion ?? lock?.versionAtLock ?? currentVersion})
                {targetVersion && targetVersion !== currentVersion && (
                  <span className="ml-1 text-warning font-normal">
                    (cũ, mới nhất v{currentVersion})
                  </span>
                )}
              </span>
              {lock && (
                <span className="ml-1 text-muted-foreground" suppressHydrationWarning>
                  — Khóa hết hạn: {new Date(lock.expiresAt).toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>
            {/* Saved */}
            <div style={{ display: state !== 'saved' ? 'none' : undefined }}>
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="ml-1 text-success-foreground">Đã lưu thành công!</span>
            </div>
            {/* Error */}
            <div style={{ display: (!error || (state !== 'error' && state !== 'editing')) ? 'none' : undefined }}>
              <AlertTriangle className="w-4 h-4 text-danger" />
              <span className="ml-1 text-danger-foreground">{error}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Save button */}
            <div style={{ display: state !== 'editing' ? 'none' : undefined }}>
              <Button
                ref={saveButtonRef as React.RefObject<HTMLButtonElement>}
                variant="primary"
                size="sm"
                onClick={handleSave}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Lưu phiên bản mới
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Đóng
            </Button>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Latest version preview side panel (re-edit mode) */}
          {latestVersionPreview && diffPanelOpen && (
            <div className="w-[420px] flex-shrink-0 border-r border-purple bg-card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-purple-soft border-b border-purple shrink-0">
                <div>
                  <p className="text-xs font-semibold text-purple-foreground">
                    Mới nhất (v{latestVersionPreview.versionNumber})
                  </p>
                  <p className="text-[10px] text-purple-foreground">Xem trước bản mới nhất</p>
                </div>
                <button
                  onClick={() => setDiffPanelOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
                  title="Đóng panel"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-muted">
                {latestPreview.loading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-purple" />
                    <p className="text-muted-foreground text-xs">Đang chuyển đổi DOCX...</p>
                  </div>
                ) : latestPreview.error ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                    <AlertTriangle className="w-8 h-8 text-danger" />
                    <p className="text-danger text-xs">{latestPreview.error}</p>
                    <button
                      onClick={() => loadLatestPreview(latestVersionPreview.versionNumber)}
                      className="text-xs text-purple hover:underline"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : latestPreview.html ? (
                  <div
                    className="p-4"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', lineHeight: '1.7', color: 'var(--foreground)' }}
                    dangerouslySetInnerHTML={{ __html: latestPreview.html }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-purple" />
                    <p className="text-muted-foreground text-xs">Đang chuyển đổi DOCX...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggle preview panel button (re-edit mode, when panel is closed) */}
          {latestVersionPreview && !diffPanelOpen && (
            <button
              onClick={() => setDiffPanelOpen(true)}
              className="w-8 flex-shrink-0 bg-purple-soft hover:bg-purple border-r border-purple flex flex-col items-center justify-center text-purple transition-colors"
              title="Xem bản mới nhất"
            >
              <span className="text-xs font-bold" style={{ writingMode: 'vertical-lr' }}>MỚI NHẤT</span>
            </button>
          )}

          {/* Main editor column */}
          <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
            {/* Non-editing overlays */}
            {state !== 'editing' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card">
                <Loader2 className="w-10 h-10 animate-spin text-info mb-4" />
                <p className="text-muted-foreground">
                  {state === 'acquiring_lock'
                    ? 'Đang khóa tài liệu để chỉnh sửa...'
                    : state === 'loading_config'
                    ? 'Đang khởi tạo OnlyOffice...'
                    : ''}
                </p>
              </div>
            )}
            {/* Saved overlay */}
            {state === 'saved' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card">
                <CheckCircle className="w-12 h-12 text-success mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">Lưu thành công!</p>
                <p className="text-muted-foreground mb-4">Tài liệu đã được lưu dưới phiên bản mới</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleClose}>Đóng</Button>
                  {onSaveSuccess && (
                    <Button variant="primary" onClick={() => {
                      onSaveSuccess(currentVersion + 1);
                      handleClose();
                    }}>
                      Xem phiên bản mới
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Error overlay */}
            {state === 'error' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card">
                <AlertTriangle className="w-12 h-12 text-danger mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">Không thể mở editor</p>
                {error && <p className="text-danger mb-4 text-center max-w-md">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleClose}>Đóng</Button>
                  <Button variant="primary" onClick={resetEditorState}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Thử lại
                  </Button>
                </div>
              </div>
            )}

            {/* Stable wrapper for editor container to protect against React insertBefore crashes.
                The SDK's internal iframed document continues to run even during
                'saving'/'saved' states (it is processing the forcesave callback).
                We wrap the container in a stable parent div with no conditional siblings.
                This ensures React never calls insertBefore/removeChild on the editor container,
                avoiding NotFoundError exceptions when the SDK directly mutates the DOM. */}
            <div className="flex-1 w-full h-full min-h-[400px] flex flex-col">
              <div
                id={editorContainerId}
                ref={editorDivRef}
                className="flex-1 w-full h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
});

export default OnlyOfficeEditorComponent;

// Declare the OnlyOffice global types for TypeScript
declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: {
        new (placeholderId: string, config: Record<string, unknown>): {
          downloadAs: (options: Record<string, unknown>) => Promise<Blob>;
          prepareSave: () => void;
          processSaveResult: (result: Record<string, unknown>, message: string) => void;
          showMessage: (title: string, msg: string) => void;
          attachMouseEvents: () => void;
          detachMouseEvents: () => void;
          destroyEditor: (cmd: Record<string, unknown>) => void;
        };
      };
    };
  }
}
