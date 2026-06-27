'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';
import { Badge, Button, EmptyState, Pagination, Spinner } from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { AppealModal, ViolationCard } from '@/components/violations';
import { Violation, ViolationStatus, ViolationStatusLabels } from '@/types/violation';
import styles from './violations.module.css';

type StatusFilter = '' | ViolationStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.values(ViolationStatus).map((status) => ({
    value: status,
    label: ViolationStatusLabels[status],
  })),
];

export default function UserViolationsPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);

  const limit = 10;

  const loadViolations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.violations.getMyViolations({
        page: currentPage,
        limit,
        status: statusFilter || undefined,
      });
      setViolations(response.data as Violation[]);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load violations:', error);
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
    loadViolations();
  }, [_hasHydrated, isAuthenticated, loadViolations, router]);

  const handleFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleAppeal = (violation: Violation) => {
    setSelectedViolation(violation);
    setAppealModalOpen(true);
  };

  const handleSubmitAppeal = async (violationId: string, appealText: string) => {
    await api.violations.submitAppeal(violationId, appealText);
    await loadViolations();
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>
              <ShieldAlert size={24} />
              Lịch sử vi phạm
            </h1>
            <p className={styles.pageSubtitle}>
              Xem lịch sử các vi phạm và khiếu nại của bạn
            </p>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.segmented} role="tablist" aria-label="Lọc trạng thái vi phạm">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                className={`${styles.segment} ${statusFilter === option.value ? styles.segmentActive : ''}`}
                onClick={() => handleFilterChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Badge variant="neutral" icon={<Bell size={14} />}>
            Tổng: {totalItems}
          </Badge>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Spinner />
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : violations.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert size={64} />}
            title="Chưa có vi phạm nào"
            description="Các vi phạm chính sách hoặc cảnh báo liên quan đến tài khoản của bạn sẽ xuất hiện tại đây khi được ghi nhận."
            action={<Button variant="secondary" onClick={() => router.push('/')}>Quay về trang hỏi đáp</Button>}
          />
        ) : (
          <>
            <div className={styles.violationList}>
              {violations.map((violation) => (
                <ViolationCard key={violation.id} violation={violation} onAppeal={handleAppeal} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </>
        )}

        <AppealModal
          open={appealModalOpen}
          onClose={() => {
            setAppealModalOpen(false);
            setSelectedViolation(null);
          }}
          violation={selectedViolation}
          onSubmit={handleSubmitAppeal}
        />
      </div>
    </MainLayout>
  );
}
