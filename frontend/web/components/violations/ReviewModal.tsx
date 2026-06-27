'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Violation, ViolationAction, ViolationActionLabels } from '@/types/violation';
import modalStyles from './ViolationModal.module.css';

export interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  violation: Violation | null;
  onSubmit: (violationId: string, action: ViolationAction) => Promise<void>;
}

export function ReviewModal({
  open,
  onClose,
  violation,
  onSubmit,
}: ReviewModalProps) {
  const [selectedAction, setSelectedAction] = useState<ViolationAction | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!violation || !selectedAction) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(violation.id, selectedAction);
      setSelectedAction('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedAction('');
      setError(null);
      onClose();
    }
  };

  const actionOptions = [
    { value: ViolationAction.DISMISSED, label: `${ViolationActionLabels[ViolationAction.DISMISSED]} - Bỏ qua vi phạm này` },
    { value: ViolationAction.WARNED, label: `${ViolationActionLabels[ViolationAction.WARNED]} - Gửi cảnh báo đến người dùng` },
    { value: ViolationAction.DEACTIVATED, label: `${ViolationActionLabels[ViolationAction.DEACTIVATED]} - Vô hiệu hóa tài khoản tạm thời` },
    { value: ViolationAction.REVOKED, label: `${ViolationActionLabels[ViolationAction.REVOKED]} - Thu hồi tài khoản vĩnh viễn` },
  ];

  return (
    <Modal open={open} onClose={handleClose} title="Xem xét vi phạm">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {violation && (
            <div className={`${modalStyles.summaryBox} space-y-2`}>
              <p className="font-medium">Thông tin vi phạm:</p>
              <div className={`${modalStyles.mutedText} grid grid-cols-2 gap-2`}>
                <p><strong>Loại:</strong> {violation.violationType}</p>
                <p><strong>Mức độ:</strong> {violation.severity}</p>
                <p><strong>Nguồn:</strong> {violation.source}</p>
                <p><strong>Trạng thái:</strong> {violation.status}</p>
              </div>
              <div className="mt-2">
                <p className="font-medium mb-1">Nội dung vi phạm:</p>
                <code className={modalStyles.codeBlock}>{violation.evidence}</code>
              </div>
              <p className={`${modalStyles.mutedText} text-xs`}>
                Ngày tạo: {new Date(violation.createdAt).toLocaleString('vi-VN')}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="action" className="block text-sm font-medium mb-2">
              Hành động xử lý <span className={modalStyles.required}>*</span>
            </label>
            <select
              id="action"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as ViolationAction)}
              disabled={isSubmitting}
              required
              className="w-full p-2 border rounded"
            >
              <option value="">Chọn hành động...</option>
              {actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && <p className={`${modalStyles.errorText} text-sm mt-1`}>{error}</p>}
          </div>

          <div className={modalStyles.warningNotice}>
            <p>
              <strong>Cảnh báo:</strong> Hành động này sẽ được ghi nhận và có thể ảnh hưởng
              đến tài khoản người dùng. Hành động <strong>DEACTIVATED</strong> và
              <strong> REVOKED</strong> sẽ tạm thời hoặc vĩnh viễn khóa tài khoản của người dùng.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant={selectedAction === ViolationAction.REVOKED ? 'destructive' : 'primary'}
            disabled={!selectedAction || isSubmitting}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ReviewModal;
