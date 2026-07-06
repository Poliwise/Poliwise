'use client';

import React, { useState } from 'react';
import { Button, Modal, Textarea } from '@/components/ui';
import { Violation } from '@/types/violation';
import modalStyles from './ViolationModal.module.css';

export interface AppealModalProps {
  open: boolean;
  onClose: () => void;
  violation: Violation | null;
  onSubmit: (violationId: string, appealText: string) => Promise<void>;
}

export function AppealModal({
  open,
  onClose,
  violation,
  onSubmit,
}: AppealModalProps) {
  const [appealText, setAppealText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!violation || !appealText.trim()) return;

    if (appealText.length > 2000) {
      setError('Nội dung khiếu nại không được vượt quá 2000 ký tự');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(violation.id, appealText.trim());
      setAppealText('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setAppealText('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Khiếu nại vi phạm">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {violation && (
            <div className={modalStyles.summaryBox}>
              <p className="font-medium mb-1">Vi phạm:</p>
              <code className={modalStyles.codeBlock}>{violation.evidence}</code>
              <p className={`${modalStyles.mutedText} mt-2`}>
                Loại: {violation.violationType} | Mức độ: {violation.severity}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="appealText" className="block text-sm font-medium mb-2">
              Nội dung khiếu nại <span className={modalStyles.required}>*</span>
            </label>
            <Textarea
              id="appealText"
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              placeholder="Nhập nội dung khiếu nại của bạn (tối đa 2000 ký tự)..."
              rows={6}
              maxLength={2000}
              disabled={isSubmitting}
              required
            />
            <div className="flex justify-between mt-1">
              {error && <p className={`${modalStyles.errorText} text-sm`}>{error}</p>}
              <p className={`${modalStyles.mutedText} text-sm ml-auto`}>
                {appealText.length}/2000 ký tự
              </p>
            </div>
          </div>

          <div className={modalStyles.infoNotice}>
            <p>
              <strong>Lưu ý:</strong> Sau khi gửi khiếu nại, đội ngũ quản trị sẽ xem xét
              và phản hồi trong thời gian sớm nhất. Bạn không thể gửi khiếu nại lại cho
              cùng một vi phạm.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={!appealText.trim() || isSubmitting}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AppealModal;
