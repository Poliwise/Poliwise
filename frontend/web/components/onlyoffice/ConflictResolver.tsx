'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Edit3, ArrowLeft, Loader2, Upload, FileText } from 'lucide-react';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import { onlyOfficeService, type LockInfo, type ConflictStatus } from '@/services/onlyoffice.service';

interface ConflictResolverProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  conflictData: {
    lock: LockInfo;
    currentVersion: number;
  };
  /** The user's current editor content (captured before editor was closed). */
  currentFile?: File | null;
  onResolved: (strategy: string, newVersion?: number) => void;
  /** Called when user picks "Chỉnh sửa lại". Parent opens editor with currentFile + preview. */
  onReEdit?: () => void;
}

type ActivePreview = 'mine' | 'theirs' | null;

export function ConflictResolver({
  open,
  onClose,
  documentId,
  documentTitle,
  conflictData,
  currentFile,
  onResolved,
  onReEdit,
}: ConflictResolverProps) {
  const { lock, currentVersion } = conflictData;
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictStatus, setConflictStatus] = useState<ConflictStatus | null>(null);

  // Per-panel preview state
  const [minePreview, setMinePreview] = useState<{
    loading: boolean;
    html: string | null;
    error: string | null;
  }>({ loading: false, html: null, error: null });

  const [theirsPreview, setTheirsPreview] = useState<{
    loading: boolean;
    html: string | null;
    error: string | null;
  }>({ loading: false, html: null, error: null });

  const lockedVersion = lock.versionAtLock;

  // Load conflict status
  useEffect(() => {
    if (!open) return;

    const loadStatus = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const status = await onlyOfficeService.getConflictStatus(documentId);
        setConflictStatus(status);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải thông tin xung đột');
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();
  }, [open, documentId]);

  // Load "mine" preview — render currentFile with mammoth or download conflict file
  const loadMinePreview = useCallback(async () => {
    if (!currentFile && !conflictStatus?.hasConflictFile) {
      setMinePreview({ loading: false, html: null, error: 'Không có nội dung từ trình chỉnh sửa.' });
      return;
    }

    setMinePreview({ loading: true, html: null, error: null });

    try {
      let arrayBuffer: ArrayBuffer;
      if (currentFile) {
        arrayBuffer = await currentFile.arrayBuffer();
      } else {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/documents/${documentId}/file`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        arrayBuffer = await res.arrayBuffer();
      }

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
      setMinePreview({ loading: false, html: value, error: null });
    } catch {
      setMinePreview({ loading: false, html: null, error: 'Không thể hiển thị tài liệu DOCX.' });
    }
  }, [currentFile, conflictStatus, documentId]);

  // Load "theirs" preview — fetch version file, render with mammoth
  const loadTheirsPreview = useCallback(async () => {
    setTheirsPreview({ loading: true, html: null, error: null });

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/documents/${documentId}/versions/${currentVersion}/download`,
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
      setTheirsPreview({ loading: false, html: value, error: null });
    } catch {
      setTheirsPreview({ loading: false, html: null, error: 'Không thể tải nội dung phiên bản này.' });
    }
  }, [documentId, currentVersion]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Hủy thay đổi — discard my changes
  const handleDiscard = useCallback(async () => {
    setIsResolving(true);
    setError(null);
    try {
      await onlyOfficeService.resolveConflict(documentId, 'discard_mine', lock.lockToken);
    } catch (err) {
      console.warn('Discard conflict changes failed (likely already released/expired):', err);
    } finally {
      setIsResolving(false);
      onResolved('discard_mine');
      onClose();
    }
  }, [documentId, lock, onResolved, onClose]);

  // Lấy bản hiện tại — upload current file as new version
  const handleKeepMine = useCallback(async () => {
    if (!currentFile) {
      setError('Không có nội dung hiện tại để tải lên. Vui lòng chọn "Chỉnh sửa lại".');
      return;
    }
    setIsResolving(true);
    setError(null);
    try {
      const result = await onlyOfficeService.resolveConflict(
        documentId,
        'merge_as_new',
        lock.lockToken,
        `Phiên bản từ conflict — sử dụng bản chỉnh sửa của tôi (v${lockedVersion})`,
        currentFile
      );
      onResolved('merge_as_new', result.newVersion);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải lên thất bại');
    } finally {
      setIsResolving(false);
    }
  }, [documentId, currentFile, lock, lockedVersion, onResolved, onClose]);

  // Chỉnh sửa lại — just tell parent to open editor with current file
  const handleReEdit = useCallback(() => {
    onReEdit?.();
  }, [onReEdit]);

  const hasFile = !!currentFile || !!conflictStatus?.hasConflictFile;

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div className="flex flex-col mx-auto mt-12 mb-8 rounded-xl shadow-2xl overflow-hidden"
        style={{ width: 'min(1400px, 95vw)', height: 'calc(100vh - 120px)' }}>
        {/* Header */}
        <div className="bg-warning-soft border-b border-warning px-6 py-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-warning-foreground font-semibold">
                Phát hiện xung đột phiên bản
              </p>
              <p className="text-sm text-warning-foreground mt-1">
                Bạn đang chỉnh sửa <strong>v{lockedVersion}</strong>,
                phiên bản mới nhất hiện tại là <strong>v{currentVersion}</strong>.
                Xem nội dung từng phiên bản bên dưới và chọn cách xử lý.
              </p>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-info" />
              <p className="text-muted-foreground">Đang tải thông tin xung đột...</p>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* LEFT: Mine */}
              <div className="flex flex-col flex-1 border-r border-border overflow-hidden">
                <div className="bg-info-soft px-4 py-3 border-b border-info shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-info-foreground">
                        Bản chỉnh sửa của tôi (từ v{lockedVersion})
                      </p>
                      <p className="text-xs text-info-foreground mt-0.5">
                        {hasFile ? 'Bản nháp đã lưu từ trình chỉnh sửa' : 'Trình chỉnh sửa đã đóng — không lấy được nội dung'}
                      </p>
                    </div>
                    {hasFile && !minePreview.html && !minePreview.error && (
                      <button
                        onClick={loadMinePreview}
                        className="flex items-center gap-1.5 text-xs text-info-foreground bg-info hover:bg-info-soft px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Xem nội dung
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-card">
                  {!hasFile ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Không có nội dung</p>
                      <p className="text-xs mt-1">Chỉ có thể xem khi đang mở trình chỉnh sửa</p>
                    </div>
                  ) : minePreview.loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-info" />
                      <p className="text-muted-foreground text-sm">Đang chuyển đổi DOCX...</p>
                    </div>
                  ) : minePreview.error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                      <AlertTriangle className="w-10 h-10 text-danger" />
                      <p className="text-danger text-sm">{minePreview.error}</p>
                      <button
                        onClick={loadMinePreview}
                        className="text-xs text-info-foreground hover:underline"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : minePreview.html ? (
                    <div
                      className="p-8 bg-muted min-h-full"
                      style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '14px', lineHeight: '1.8', color: '#1a1a1a' }}
                      dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(minePreview.html) : '' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Nhấn "Xem nội dung" để xem trước</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Latest */}
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="bg-purple-soft px-4 py-3 border-b border-purple shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-purple-foreground">
                        Mới nhất (v{currentVersion})
                      </p>
                      <p className="text-xs text-purple-foreground mt-0.5">
                        {conflictStatus?.diffInfo?.theirCreatedByUsername} — {conflictStatus?.diffInfo?.theirCreatedAt
                          ? new Date(conflictStatus.diffInfo.theirCreatedAt).toLocaleString('vi-VN')
                          : ''}
                      </p>
                      {conflictStatus?.diffInfo?.theirChangelog && (
                        <p className="text-xs text-purple italic mt-0.5">
                          Ghi chú: {conflictStatus.diffInfo.theirChangelog}
                        </p>
                      )}
                    </div>
                    {!theirsPreview.html && !theirsPreview.error && (
                      <button
                        onClick={loadTheirsPreview}
                        className="flex items-center gap-1.5 text-xs text-purple-foreground bg-purple hover:bg-purple-soft px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Xem nội dung
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-card">
                  {theirsPreview.loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-purple" />
                      <p className="text-muted-foreground text-sm">Đang chuyển đổi DOCX...</p>
                    </div>
                  ) : theirsPreview.error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                      <AlertTriangle className="w-10 h-10 text-danger" />
                      <p className="text-danger text-sm">{theirsPreview.error}</p>
                      <button
                        onClick={loadTheirsPreview}
                        className="text-xs text-purple-foreground hover:underline"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : theirsPreview.html ? (
                    <div
                      className="p-8 bg-muted min-h-full"
                      style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '14px', lineHeight: '1.8', color: '#1a1a1a' }}
                      dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(theirsPreview.html) : '' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Nhấn "Xem nội dung" để xem trước</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 flex items-center gap-2 text-danger-foreground text-sm bg-danger-soft px-4 py-2 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Action buttons */}
        {!isLoading && (
          <div className="border border-border bg-muted px-6 py-4 flex-shrink-0">
            <div className="grid grid-cols-3 gap-4">
              {/* Hủy */}
              <button
                onClick={handleDiscard}
                disabled={isResolving}
                className="flex flex-col items-center p-4 rounded-lg border-2 border-warning bg-card hover:border-warning hover:bg-warning-soft transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-6 h-6 text-warning mb-2" />
                <span className="text-sm font-semibold text-warning-foreground">Hủy thay đổi</span>
                <span className="text-xs text-muted-foreground mt-1 text-center">
                  Giữ nguyên phiên bản v{currentVersion}, không tải lên gì
                </span>
              </button>

              {/* Lấy bản hiện tại */}
              <button
                onClick={handleKeepMine}
                disabled={isResolving || !hasFile}
                className="flex flex-col items-center p-4 rounded-lg border-2 border-success bg-card hover:border-success hover:bg-success-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!hasFile ? 'Không có nội dung — cần mở lại trình chỉnh sửa' : undefined}
              >
                {isResolving ? (
                  <Loader2 className="w-6 h-6 text-success mb-2 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-success mb-2" />
                )}
                <span className="text-sm font-semibold text-success-foreground">Lấy bản hiện tại</span>
                <span className="text-xs text-muted-foreground mt-1 text-center">
                  {hasFile
                    ? `Tải bản của tôi lên thành phiên bản mới (v${currentVersion + 1})`
                    : 'Không có nội dung — cần mở lại trình chỉnh sửa'}
                </span>
              </button>

              {/* Chỉnh sửa lại */}
              <button
                onClick={handleReEdit}
                disabled={isResolving}
                className="flex flex-col items-center p-4 rounded-lg border-2 border-info bg-card hover:border-info hover:bg-info-soft transition-colors disabled:opacity-50"
              >
                {isResolving ? (
                  <Loader2 className="w-6 h-6 text-info mb-2 animate-spin" />
                ) : (
                  <Edit3 className="w-6 h-6 text-info mb-2" />
                )}
                <span className="text-sm font-semibold text-info-foreground">Chỉnh sửa lại</span>
                <span className="text-xs text-muted-foreground mt-1 text-center">
                  Mở OnlyOffice với bản hiện tại + xem trước bản mới nhất
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
