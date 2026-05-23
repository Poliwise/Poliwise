'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle, GitMerge, Trash2, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { onlyOfficeService, type LockInfo, type ConflictStatus, type VersionDiff } from '@/services/onlyoffice.service';
import { documentService } from '@/services/document.service';
import { Button } from '@/components/ui/button/Button';
import { Modal } from '@/components/ui/modal/Modal';

interface ConflictResolverProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  conflictData: {
    lock: LockInfo;
    currentVersion: number;
  };
  onResolved: (strategy: string, newVersion?: number) => void;
  isAdmin: boolean;
}

type DiffLine = {
  type: 'UNCHANGED' | 'ADDED' | 'DELETED';
  lineNumber: number;
  content: string;
};

export function ConflictResolver({
  open,
  onClose,
  documentId,
  documentTitle,
  conflictData,
  onResolved,
  isAdmin,
}: ConflictResolverProps) {
  const { lock, currentVersion } = conflictData;
  const [view, setView] = useState<'diff' | 'resolving'>('diff');
  const [selectedStrategy, setSelectedStrategy] = useState<'merge_as_new' | 'discard_mine' | 'force_push'>('merge_as_new');
  const [mergeChangelog, setMergeChangelog] = useState('');
  const [mergedFile, setMergedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [conflictStatus, setConflictStatus] = useState<ConflictStatus | null>(null);

  const lockedVersion = lock.versionAtLock;

  // Load diff data
  useEffect(() => {
    if (!open) return;

    const loadDiff = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [status, diff] = await Promise.all([
          onlyOfficeService.getConflictStatus(documentId),
          onlyOfficeService.getVersionDiff(documentId, lockedVersion, currentVersion),
        ]);
        setConflictStatus(status);
        setDiffLines(diff.lines as DiffLine[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải thông tin xung đột');
      } finally {
        setIsLoading(false);
      }
    };

    loadDiff();
  }, [open, documentId, lockedVersion, currentVersion]);

  const handleResolve = useCallback(async () => {
    setIsResolving(true);
    setError(null);

    try {
      if (selectedStrategy === 'discard_mine') {
        await onlyOfficeService.resolveConflict(documentId, 'discard_mine', lock.lockToken);
        onResolved('discard_mine');
        onClose();
        return;
      }

      if (selectedStrategy === 'force_push' || selectedStrategy === 'merge_as_new') {
        if (!mergedFile) {
          setError('Vui lòng tải lên file đã merge trước khi lưu.');
          setIsResolving(false);
          return;
        }

        const result = await onlyOfficeService.resolveConflict(
          documentId,
          selectedStrategy,
          lock.lockToken,
          selectedStrategy === 'merge_as_new' ? mergeChangelog : 'Force-pushed version',
          mergedFile
        );

        onResolved(selectedStrategy, result.newVersion);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giải quyết xung đột thất bại');
    } finally {
      setIsResolving(false);
    }
  }, [selectedStrategy, mergedFile, mergeChangelog, documentId, lock, onResolved, onClose]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'ADDED').length;
    const deleted = diffLines.filter(l => l.type === 'DELETED').length;
    return { added, deleted };
  }, [diffLines]);

  const renderDiffLine = (line: DiffLine, idx: number) => {
    const prefix = line.type === 'ADDED' ? '+' : line.type === 'DELETED' ? '-' : ' ';
    const bgClass = line.type === 'ADDED'
      ? 'bg-green-50 text-green-900'
      : line.type === 'DELETED'
      ? 'bg-red-50 text-red-900'
      : 'text-gray-700';

    return (
      <div
        key={idx}
        className={`flex font-mono text-xs leading-6 ${bgClass}`}
      >
        <span className="w-12 flex-shrink-0 text-right pr-3 text-gray-400 select-none border-r border-gray-200 mr-3">
          {line.type === 'DELETED' ? line.lineNumber : line.type === 'ADDED' ? line.lineNumber : ' '}
        </span>
        <span className="w-5 flex-shrink-0 text-center select-none text-gray-400">{prefix}</span>
        <span className="whitespace-pre-wrap break-all flex-1 px-2">{line.content || ' '}</span>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Giải quyết xung đột: ${documentTitle}`}
      size="full"
    >
      <div className="flex flex-col" style={{ height: 'calc(90vh - 120px)' }}>
        {/* Header explanation */}
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-orange-900 font-medium">
                Xung đột phiên bản được phát hiện!
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Trong khi bạn đang chỉnh sửa phiên bản <strong>v{lockedVersion}</strong>,
                người khác đã tải lên phiên bản <strong>v{currentVersion}</strong> mới hơn.
                Bạn cần giải quyết xung đột trước khi có thể lưu thay đổi của mình.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-500">Đang tải thông tin xung đột...</p>
            </div>
          ) : error && !conflictStatus ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
              <p className="text-red-600">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Thử lại
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* LEFT: Base version (what we started editing) */}
              <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                  <p className="text-sm font-semibold text-blue-900">
                    Cơ sở (v{lockedVersion})
                  </p>
                  <p className="text-xs text-blue-600">
                    Phiên bản bạn bắt đầu chỉnh sửa
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                  <pre className="text-xs font-mono leading-6 p-3 whitespace-pre-wrap break-all text-gray-700 bg-white h-full">
                    {conflictStatus?.diffInfo?.baseContent
                      || (diffLines.filter(l => l.type === 'DELETED' || l.type === 'UNCHANGED')
                          .map(l => l.content).join('\n'))
                      || 'Không có nội dung'}
                  </pre>
                </div>
              </div>

              {/* CENTER: The diff */}
              <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Sự khác biệt</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600">+{stats.added} dòng</span>
                      <span className="text-red-600">-{stats.deleted} dòng</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Thay đổi của bạn so với phiên bản mới nhất
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                  {diffLines.length > 0 ? (
                    <div>{diffLines.map(renderDiffLine)}</div>
                  ) : (
                    <pre className="text-xs font-mono leading-6 p-3 text-gray-500">
                      Không có sự khác biệt về text giữa hai phiên bản
                    </pre>
                  )}
                </div>
              </div>

              {/* RIGHT: Their version (newest) */}
              <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-900">
                        Mới nhất (v{currentVersion})
                      </p>
                      <p className="text-xs text-purple-600">
                        Phiên bản mới nhất đã được tải lên bởi người khác
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        documentService.downloadVersion(documentId, currentVersion, `version-${currentVersion}`);
                      }}
                      className="text-xs px-2 py-1 border border-purple-300 rounded text-purple-700 hover:bg-purple-100 transition-colors"
                      title="Tải về phiên bản mới nhất"
                    >
                      Tải về
                    </button>
                  </div>
                  {conflictStatus?.diffInfo?.theirChangelog && (
                    <p className="text-xs text-purple-500 italic mt-1">
                      Ghi chú: {conflictStatus.diffInfo.theirChangelog}
                    </p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                  <pre className="text-xs font-mono leading-6 p-3 whitespace-pre-wrap break-all text-gray-700 bg-white h-full">
                    {conflictStatus?.diffInfo?.theirContent
                      || (diffLines.filter(l => l.type === 'ADDED' || l.type === 'UNCHANGED')
                          .map(l => l.content).join('\n'))
                      || 'Không có nội dung'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resolution strategy picker */}
        {!isLoading && conflictStatus && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Chọn cách giải quyết:</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Strategy 1: Merge as new version */}
              <button
                type="button"
                onClick={() => setSelectedStrategy('merge_as_new')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedStrategy === 'merge_as_new'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <GitMerge className={`w-5 h-5 mb-2 ${selectedStrategy === 'merge_as_new' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${selectedStrategy === 'merge_as_new' ? 'text-blue-900' : 'text-gray-700'}`}>
                  Merge &amp; Lưu mới
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tải lên file đã merge của bạn dưới dạng phiên bản mới
                </p>
              </button>

              {/* Strategy 2: Discard mine */}
              <button
                type="button"
                onClick={() => setSelectedStrategy('discard_mine')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedStrategy === 'discard_mine'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-300'
                }`}
              >
                <Trash2 className={`w-5 h-5 mb-2 ${selectedStrategy === 'discard_mine' ? 'text-orange-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${selectedStrategy === 'discard_mine' ? 'text-orange-900' : 'text-gray-700'}`}>
                  Bỏ thay đổi của tôi
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Giữ phiên bản mới nhất, hủy bỏ thay đổi của bạn
                </p>
              </button>

              {/* Strategy 3: Force push (ADMIN only) */}
              <button
                type="button"
                onClick={() => setSelectedStrategy('force_push')}
                disabled={!isAdmin}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  !isAdmin
                    ? 'border-gray-100 bg-gray-100 cursor-not-allowed opacity-50'
                    : selectedStrategy === 'force_push'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-red-300'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 mb-2 ${!isAdmin ? 'text-gray-300' : selectedStrategy === 'force_push' ? 'text-red-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${!isAdmin ? 'text-gray-400' : selectedStrategy === 'force_push' ? 'text-red-900' : 'text-gray-700'}`}>
                  Ghi đè {isAdmin ? '' : '(ADMIN)'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {isAdmin
                    ? 'Ghi đè phiên bản mới nhất bằng file của bạn'
                    : 'Chỉ ADMIN mới có quyền ghi đè'}
                </p>
              </button>
            </div>

            {/* Strategy-specific inputs */}
            {(selectedStrategy === 'merge_as_new' || selectedStrategy === 'force_push') && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedStrategy === 'merge_as_new' ? 'Ghi chú thay đổi (tùy chọn)' : 'Ghi chú'}
                  </label>
                  <input
                    type="text"
                    value={mergeChangelog}
                    onChange={e => setMergeChangelog(e.target.value)}
                    placeholder={selectedStrategy === 'merge_as_new'
                      ? 'VD: Merge changes from v2 and v3'
                      : 'VD: Force-pushed: hotfix critical bug'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File đã merge <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".docx,.doc,.txt,.md"
                    onChange={e => setMergedFile(e.target.files?.[0] ?? null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedStrategy === 'merge_as_new'
                      ? 'Tải lên file bạn đã merge từ các thay đổi'
                      : 'Tải lên file để ghi đè phiên bản mới nhất'}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
          <Button variant="outline" onClick={onClose} disabled={isResolving}>
            Hủy bỏ
          </Button>
          <Button
            variant="primary"
            onClick={handleResolve}
            disabled={
              isResolving ||
              isLoading ||
              (selectedStrategy !== 'discard_mine' && !mergedFile)
            }
          >
            {isResolving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {selectedStrategy === 'discard_mine' && 'Bỏ thay đổi'}
                {selectedStrategy === 'merge_as_new' && 'Lưu phiên bản mới'}
                {selectedStrategy === 'force_push' && 'Ghi đè'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
