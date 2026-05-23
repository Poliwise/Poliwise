'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Lock, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { onlyOfficeService, type LockInfo } from '@/services/onlyoffice.service';
import { Button } from '@/components/ui/button/Button';
import { Modal } from '@/components/ui/modal/Modal';

interface OnlyOfficeEditorProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  fileType: string;
  currentVersion: number;
  /** If provided, lock and edit this specific version (for editing old versions). */
  targetVersion?: number;
  onSaveSuccess?: (newVersion: number) => void;
  onConflictDetected?: (conflictData: {
    lock: LockInfo;
    currentVersion: number;
  }) => void;
}

type EditorState =
  | 'acquiring_lock'
  | 'loading_config'
  | 'editing'
  | 'saving'
  | 'conflict_detected'
  | 'saved'
  | 'error'
  | 'conflict';

export default function OnlyOfficeEditor({
  open,
  onClose,
  documentId,
  documentTitle,
  fileType: _fileType,
  currentVersion,
  targetVersion,
  onSaveSuccess,
  onConflictDetected,
}: OnlyOfficeEditorProps) {
  const editorDivRef = useRef<HTMLDivElement>(null);
  // Ref-based guard so the effect doesn't re-run when editorReady changes
  const editorInitRef = useRef(false);
  // Stable ID for OnlyOffice container — generated once at client mount to avoid
  // SSR/hydration mismatch. Using useRef with a lazy initializer ensures the value
  // is only computed once on the client, not during SSR where Date.now() would
  // differ from the client-rendered value and cause React error #418.
  const editorContainerId = useRef<string | null>(null);
  const [state, setState] = useState<EditorState>('acquiring_lock');
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<LockInfo | null>(null);
  const [editorConfig, setEditorConfig] = useState<Record<string, unknown> | null>(null);
  const [lockRefreshInterval, setLockRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [conflictPollInterval, setConflictPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [docsEditorInstance, setDocsEditorInstance] = useState<unknown>(null);

  // Stable editor container ID — computed only on the client after hydration to avoid
  // React hydration mismatch (error #418) that occurs when Date.now() differs between
  // server render and client hydration. Uses a ref to store the value so it persists
  // across re-renders without recalculating Date.now().
  if (editorContainerId.current === null) {
    editorContainerId.current = `onlyoffice-editor-${documentId}-${Date.now()}`;
  }

  // Defer timezone-dependent formatting until after hydration
  useEffect(() => { setMounted(true); }, []);

  const cleanup = useCallback(() => {
    if (lockRefreshInterval) {
      clearInterval(lockRefreshInterval);
      setLockRefreshInterval(null);
    }
    if (conflictPollInterval) {
      clearInterval(conflictPollInterval);
      setConflictPollInterval(null);
    }
    // Only release the lock if we are NOT in the middle of saving.
    // When saving, the backend releases the lock after processing the save callback.
    // If we release it here before the callback arrives, the save fails.
    if (lock && state !== 'saving') {
      onlyOfficeService.releaseLock(documentId, lock.lockToken).catch(() => {});
    }
    setLock(null);
    setEditorConfig(null);
    setEditorReady(false);
    setDocsEditorInstance(null);
    editorInitRef.current = false;
    setState('acquiring_lock');
    setError(null);
  }, [lock, lockRefreshInterval, conflictPollInterval, documentId]);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  // Trigger OnlyOffice save.
  // The embedded SDK doesn't support programmatic save. Instead, users must click
  // "File → Save As" inside OnlyOffice. This fires the onRequestSaveAs event which
  // triggers the save callback pipeline (status=2 → backend downloads file → new version).
  const handleSave = useCallback(async () => {
    console.log('[handleSave] called — showing save instructions');
    setError('Nhấn "File → Save As" trong thanh công cụ OnlyOffice để lưu phiên bản mới.');
  }, []);

  // Release the lock after a successful save completes, then close the editor.
  // The backend already releases the lock on its side; we do the same on the client.
  useEffect(() => {
    if (state === 'saved' && lock) {
      onlyOfficeService.releaseLock(documentId, lock.lockToken).catch(() => {});
      setLock(null);
      onSaveSuccess?.(currentVersion + 1);
      onClose();
    }
  }, [state, lock, documentId, currentVersion, onSaveSuccess, onClose]);

  // Acquire lock + load editor config on open
  useEffect(() => {
    if (!open) return;

    const init = async () => {
      try {
        setState('acquiring_lock');
        const lockInfo = await onlyOfficeService.acquireLock(documentId, targetVersion);
        setLock(lockInfo);
        setState('loading_config');
        const config = await onlyOfficeService.getEditorConfig(documentId);
        setEditorConfig(config);
        setState('editing');

        const interval = setInterval(async () => {
          try {
            const refreshed = await onlyOfficeService.acquireLock(documentId, targetVersion);
            setLock(refreshed);
          } catch {
            setError('Phiên chỉnh sửa đã hết hạn. Vui lòng đóng và mở lại editor.');
          }
        }, 5 * 60 * 1000);
        setLockRefreshInterval(interval);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể mở editor';
        setError(msg);
        setState('error');
      }
    };

    init();

    return cleanup;
  }, [open, documentId, targetVersion]);

  // Listen for messages from OnlyOffice iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from our OnlyOffice server origin
      const ooUrl = onlyOfficeService.getDocumentServerUrl();
      const allowedOrigin = ooUrl.replace(/^http/, 'http');
      if (!event.origin.startsWith(allowedOrigin.replace(/\/$/, ''))) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // OnlyOffice iframe events
      switch (data.type) {
        case 'onlyoffice_ready': {
          // The iframe is ready. User must click "File → Save As" inside OnlyOffice
          // to trigger the save pipeline. The onRequestSaveAs event fires, we call
          // processSaveResult(true) to let OnlyOffice proceed, then poll for result.
          console.log('[OnlyOffice] iframe document ready');
          break;
        }
        case 'onlyoffice_save_as': {
          // User clicked "File → Save As" in the OnlyOffice toolbar.
          // Tell OnlyOffice to proceed with the save (this triggers status=2 callback).
          // Then poll until lock is released = save succeeded.
          setState('saving');
          setError(null);
          const iframe = document.getElementById(editorContainerId.current!);
          if (iframe && (iframe as HTMLIFrameElement).contentWindow) {
            const iframeWin = (iframe as HTMLIFrameElement).contentWindow!;
            if ((iframeWin as any).DocsAPI?.instances?.[editorContainerId.current!]) {
              (iframeWin as any).DocsAPI.instances[editorContainerId.current!].processSaveResult(true);
            }
          }
          for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 1500));
            try {
              const conflictStatus = await onlyOfficeService.getConflictStatus(documentId);
              if (conflictStatus.hasConflict) {
                setState('conflict_detected');
                if (onConflictDetected && lock) {
                  onConflictDetected({ lock, currentVersion: conflictStatus.currentVersion });
                }
                return;
              }
              const lockInfo = await onlyOfficeService.getLockStatus(documentId);
              if (!lockInfo?.locked) {
                setState('saved');
                return;
              }
            } catch { /* keep polling */ }
          }
          setError('Lưu thất bại: hệ thống không phản hồi.');
          setState('editing');
          break;
        }
        case 'onDocumentStateChange': {
          if (data.data === 0) {
            handleClose();
          }
          break;
        }
        case 'onConflictDetected': {
          setState('conflict_detected');
          if (onConflictDetected && lock) {
            const status = await onlyOfficeService.getConflictStatus(documentId);
            onConflictDetected({ lock, currentVersion: status.currentVersion });
          }
          break;
        }
        case 'onSaved':
        case 'onSave': {
          setState('saving');
          break;
        }
        case 'onError': {
          setError('Lỗi OnlyOffice: ' + (data.data?.message || 'Lỗi không xác định'));
          setState('error');
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [lock, documentId, onConflictDetected, handleClose]);

  // Inject OnlyOffice SDK script and initialize editor
  useEffect(() => {
    if (state !== 'editing' || !editorConfig || !editorDivRef.current || editorInitRef.current) {
      return;
    }

    editorInitRef.current = true;

    const ooUrl = onlyOfficeService.getDocumentServerUrl();

    const script = document.createElement('script');
    script.src = `${ooUrl}/web-apps/apps/api/documents/api.js`;

    const onLoad = () => {
      if (!document.head.contains(script)) {
        document.head.appendChild(script);
      }
      if (typeof window.DocsAPI === 'undefined') {
        setError('Không thể tải OnlyOffice API');
        setState('error');
        return;
      }

      try {
        const config = editorConfig as {
          document: { title: string; fileType: string; url: string; key: string };
          documentType: string;
          editorConfig: { user: { id: string; name: string }; lang: string };
          token?: string;
        };

        const placeholderId = editorContainerId.current!;

        const instance = new window.DocsAPI.DocEditor(placeholderId, {
          document: { ...config.document },
          documentType: config.documentType,
          editorConfig: { ...config.editorConfig, mode: 'edit' },
          token: config.token,
          type: (editorConfig as any).type ?? 'desktop',
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
              console.log('[OnlyOffice] iframe document ready');
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

        console.log('[OnlyOffice] DocEditor instance created:', instance);
        setEditorReady(true);
        setDocsEditorInstance(instance);
        window.parent.postMessage({ type: 'onEditorReady', documentId }, '*');
      } catch (err) {
        setError('Không thể khởi tạo OnlyOffice: ' + (err instanceof Error ? err.message : String(err)));
        setState('error');
      }
    };

    script.onload = onLoad;
    script.onerror = () => {
      setError('Không thể tải OnlyOffice API script');
      setState('error');
    };

    document.head.appendChild(script);
  }, [state]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Chỉnh sửa: ${documentTitle}`}
      size="full"
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm shrink-0">
          <div className="flex items-center gap-3">
            {/* Acquiring lock */}
            <div style={{ display: state !== 'acquiring_lock' ? 'none' : undefined }}>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="ml-1">Đang khóa tài liệu...</span>
            </div>
            {/* Loading config */}
            <div style={{ display: state !== 'loading_config' ? 'none' : undefined }}>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="ml-1">Đang tải cấu hình editor...</span>
            </div>
            {/* Editing */}
            <div style={{ display: state !== 'editing' ? 'none' : undefined }}>
              <Lock className="w-4 h-4 text-green-600" />
              <span className="ml-1 text-green-700 font-medium">
                Đang chỉnh sửa (phiên bản v{targetVersion ?? lock?.versionAtLock ?? currentVersion})
                {targetVersion && targetVersion !== currentVersion && (
                  <span className="ml-1 text-amber-600 font-normal">
                    (cũ, mới nhất v{currentVersion})
                  </span>
                )}
              </span>
              {lock && (
                <span className="ml-1 text-gray-500" suppressHydrationWarning>
                  — Khóa hết hạn: {mounted ? new Date(lock.expiresAt).toLocaleTimeString('vi-VN') : ''}
                </span>
              )}
            </div>
            {/* Saving */}
            <div style={{ display: state !== 'saving' ? 'none' : undefined }}>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="ml-1">Đang lưu...</span>
            </div>
            {/* Saved */}
            <div style={{ display: state !== 'saved' ? 'none' : undefined }}>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="ml-1 text-green-700">Đã lưu thành công!</span>
            </div>
            {/* Conflict detected from save callback */}
            <div style={{ display: state !== 'conflict_detected' ? 'none' : undefined }}>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="ml-1 text-orange-700 font-medium">
                Phát hiện xung đột! Vui lòng đợi...
              </span>
            </div>
            {/* Error */}
            <div style={{ display: state !== 'error' || !error ? 'none' : undefined }}>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="ml-1 text-red-700">{error}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Save button — editing state */}
            <div style={{ display: state !== 'editing' ? 'none' : undefined }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSave()}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Lưu phiên bản mới
              </Button>
            </div>
            {/* Saving spinner */}
            <div style={{ display: state !== 'saving' ? 'none' : undefined }}>
              <Button variant="primary" size="sm" disabled>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Đang lưu...
              </Button>
            </div>
            {/* Conflict buttons */}
            <div style={{ display: (state !== 'conflict_detected') ? 'none' : undefined }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (onConflictDetected && lock) {
                    onConflictDetected({ lock, currentVersion });
                  }
                }}
              >
                Giải quyết xung đột
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Đóng
            </Button>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Non-editing overlays */}
          {state !== 'editing' && (
            <div className="flex flex-col items-center justify-center flex-1 bg-white">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">
                {state === 'acquiring_lock'
                  ? 'Đang khóa tài liệu để chỉnh sửa...'
                  : state === 'loading_config'
                  ? 'Đang khởi tạo OnlyOffice...'
                  : state === 'saving'
                  ? 'Đang lưu...'
                  : state === 'conflict_detected'
                  ? 'Đang xử lý xung đột...'
                  : ''}
              </p>
            </div>
          )}

          {/* Saved overlay */}
          {state === 'saved' && (
            <div className="flex flex-col items-center justify-center flex-1 bg-white">
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-800 mb-2">Lưu thành công!</p>
              <p className="text-gray-500 mb-4">Tài liệu đã được lưu dưới phiên bản mới</p>
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
            <div className="flex flex-col items-center justify-center flex-1 bg-white">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-lg font-medium text-gray-800 mb-2">Không thể mở editor</p>
              {error && <p className="text-red-600 mb-4 text-center max-w-md">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose}>Đóng</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    editorInitRef.current = false;
                    setState('acquiring_lock');
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Thử lại
                </Button>
              </div>
            </div>
          )}

          {/* Editor container */}
          {state === 'editing' && (
            <div
              id={editorContainerId.current ?? undefined}
              ref={editorDivRef}
              className="flex-1 min-h-[400px]"
              style={{ display: 'flex', flexDirection: 'column' }}
              suppressHydrationWarning
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

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
        };
      };
    };
  }
}
