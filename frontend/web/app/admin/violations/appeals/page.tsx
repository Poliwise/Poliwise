'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, MessageSquare, XCircle } from 'lucide-react';
import { useAuthStore, useIsAdmin } from '@/store';
import { api } from '@/lib/api';
import { Badge, Button, ConfirmDialog, EmptyState, Pagination, Spinner } from '@/components/ui';
import { ViolationCard } from '@/components/violations';
import { AppealStatus, AppealStatusLabels, Violation } from '@/types/violation';
import styles from './admin-violations.module.css';

type AppealStatusFilter = '' | AppealStatus;

const STATUS_OPTIONS: { value: AppealStatusFilter; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.values(AppealStatus).map((status) => ({
    value: status,
    label: AppealStatusLabels[status],
  })),
];

export default function AdminAppealsPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const isAdmin = useIsAdmin();

  const [appeals, setAppeals] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState<AppealStatusFilter>('');
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    appealId: string | null;
    action: 'approve' | 'reject' | null;
  }>({ open: false, appealId: null, action: null });
  const [isProcessing, setIsProcessing] = useState(false);

  const limit = 10;

  const loadAppeals = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.violations.getAppeals({
        page: currentPage,
        limit,
        status: statusFilter || undefined,
      });
      setAppeals(response.data as Violation[]);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load appeals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadAppeals();
  }, [_hasHydrated, isAuthenticated, isAdmin, loadAppeals, router]);

  const handleStatusFilterChange = (value: AppealStatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleReviewAction = (appealId: string, action: 'approve' | 'reject') => {
    setConfirmModal({ open: true, appealId, action });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.appealId || !confirmModal.action) return;

    try {
      setIsProcessing(true);
      await api.violations.reviewAppeal(
        confirmModal.appealId,
        confirmModal.action === 'approve'
      );
      await loadAppeals();
      setConfirmModal({ open: false, appealId: null, action: null });
    } catch (error) {
      console.error('Failed to review appeal:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeConfirm = () => {
    if (!isProcessing) {
      setConfirmModal({ open: false, appealId: null, action: null });
    }
  };

  const isApprove = confirmModal.action === 'approve';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.push('/admin/users')} className={styles.backButton}>
          <ArrowLeft size={16} />
          Quay lại
        </button>
        <div className={styles.titleSection}>
          <h1 className={styles.pageTitle}>
            <MessageSquare size={24} />
            Khiếu nại vi phạm
          </h1>
          <p className={styles.pageSubtitle}>
            Xem xét và phản hồi các khiếu nại từ người dùng
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.segmented} role="tablist" aria-label="Lọc trạng thái khiếu nại">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              className={`${styles.segment} ${statusFilter === option.value ? styles.segmentActive : ''}`}
              onClick={() => handleStatusFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Badge variant="neutral">Tổng: {totalItems}</Badge>
      </div>

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <Spinner />
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : appeals.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={64} />}
          title="Không có khiếu nại nào"
          description="Không có khiếu nại nào cần xem xét với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className={styles.violationList}>
            {appeals.map((appeal) => (
              <div key={appeal.id} className={styles.appealItem}>
                <ViolationCard violation={appeal} showUser />
                {appeal.appealStatus === AppealStatus.PENDING && (
                  <div className={styles.appealActions}>
                    <Button
                      onClick={() => handleReviewAction(appeal.id, 'approve')}
                      variant="success"
                      size="sm"
                      icon={<CheckCircle size={16} />}
                    >
                      Chấp nhận
                    </Button>
                    <Button
                      onClick={() => handleReviewAction(appeal.id, 'reject')}
                      variant="dangerOutline"
                      size="sm"
                      icon={<XCircle size={16} />}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationWrapper}>
              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmModal.open}
        onClose={closeConfirm}
        onConfirm={handleConfirmAction}
        title={isApprove ? 'Chấp nhận khiếu nại' : 'Từ chối khiếu nại'}
        message={
          isApprove
            ? 'Chấp nhận khiếu nại sẽ xóa bỏ vi phạm và khôi phục điểm strike của người dùng.'
            : 'Từ chối khiếu nại sẽ giữ nguyên vi phạm và hành động đã được thực hiện.'
        }
        confirmLabel={isProcessing ? 'Đang xử lý...' : 'Xác nhận'}
        cancelLabel="Hủy"
        variant={isApprove ? 'info' : 'danger'}
        loading={isProcessing}
      />
    </div>
  );
}
