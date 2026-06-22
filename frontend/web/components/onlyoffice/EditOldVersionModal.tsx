'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Edit,
  Loader2,
} from 'lucide-react';
import { VersionDiffViewer } from './VersionDiffViewer';
import { Button } from '@/components/ui/button/Button';
import { Modal } from '@/components/ui/modal/Modal';
import type { DocumentVersion } from '@/types/document';

interface EditOldVersionModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  version: DocumentVersion;
  currentVersion: number;
  onOpenEditor: (targetVersion: number) => void;
}

export function EditOldVersionModal({
  open,
  onClose,
  documentId,
  documentTitle,
  version,
  currentVersion,
  onOpenEditor,
}: EditOldVersionModalProps) {
  const [understood, setUnderstood] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chỉnh sửa phiên bản cũ`}
      size="md"
    >
      <div className="flex flex-col gap-4">
        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-900 font-medium">
              Bạn đang chỉnh sửa một phiên bản cũ
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Phiên bản bạn chọn là <strong>v{version.versionNumber}</strong>, nhưng phiên bản mới nhất hiện tại là{' '}
              <strong>v{currentVersion}</strong>. Sau khi lưu, hệ thống sẽ phát hiện xung đột
              và bạn cần giải quyết trước khi tạo phiên bản mới.
            </p>
          </div>
        </div>

        {/* Version info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Thông tin phiên bản</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Phiên bản:</span>
              <span className="ml-2 font-medium text-gray-900">v{version.versionNumber}</span>
            </div>
            <div>
              <span className="text-gray-500">Changelog:</span>
              <span className="ml-2 text-gray-900">{version.changelog || version.changesDescription || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Ngày tạo:</span>
              <span className="ml-2 text-gray-900">
                {version.createdAt ? new Date(version.createdAt).toLocaleString('vi-VN') : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Người tạo:</span>
              <span className="ml-2 text-gray-900">
                {version.uploadedByName || version.createdBy || version.uploadedBy || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Workflow explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">Quy trình hoạt động</h3>
          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
            <li>Bạn mở OnlyOffice với nội dung của <strong>v{version.versionNumber}</strong></li>
            <li>Chỉnh sửa và lưu trong OnlyOffice</li>
            <li>Hệ thống phát hiện xung đột vì có phiên bản mới hơn</li>
            <li>Bạn giải quyết xung đột: merge file, ghi đè, hoặc bỏ thay đổi</li>
            <li>Hệ thống tạo phiên bản mới từ kết quả merge của bạn</li>
          </ol>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={understood}
            onChange={e => setUnderstood(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Tôi hiểu rủi ro và muốn tiếp tục
          </span>
        </label>

        {/* Error note */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Lưu ý: Nếu người khác đã chỉnh sửa cùng phiên bản này trước đó, phiên bản cũ có thể
            không còn chính xác. Trong trường hợp này, hãy cân nhắc "Kéo phiên bản mới nhất"
            thay vì chỉnh sửa phiên bản cũ.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onOpenEditor(version.versionNumber);
              onClose();
            }}
            disabled={!understood}
          >
            <Edit className="w-4 h-4 mr-2" />
            Mở OnlyOffice
          </Button>
        </div>
      </div>
    </Modal>
  );
}
