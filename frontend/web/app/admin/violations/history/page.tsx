'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuthStore, useIsAdmin } from '@/store';
import { api } from '@/lib/api';
import { Badge, EmptyState, Pagination, Spinner } from '@/components/ui';
import { ViolationCard } from '@/components/violations';
import { Violation, ViolationAction, ViolationStatusLabels } from '@/types/violation';
import styles from '../admin-violations.module.css';

type ActionFilter = '' | ViolationAction;

const ACTION_OPTIONS: { value: ActionFilter; label: string }[] = [
  { value: '', label: 'Tất cả hành động' },
  { value: ViolationAction.DISMISSED, label: 'Bỏ qua' },
  { value: ViolationAction.WARNED, label: 'Cảnh cáo' },
  { value: ViolationAction.DEACTIVATED, label: 'Vô hiệu hóa' },
  { value: ViolationAction.REVOKED, label: 'Thu hồi' },
];

export default function AdminViolationHistoryPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const isAdmin = useIsAdmin();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('');

  const limit = 10;

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.violations.getActionedViolations({
        page: currentPage,
        limit,
        action: actionFilter || undefined,
      });
      setViolations(response.data as Violation[]);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load violation history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, actionFilter]);

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
    loadHistory();
  }, [_hasHydrated, isAuthenticated, isAdmin, loadHistory, router]);

  const handleFilterChange = (value: ActionFilter) => {
    setActionFilter(value);
    setCurrentPage(1);
  };

  const getActionIcon = (action?: ViolationAction) => {
    switch (action) {
      case ViolationAction.DISMISSED:
        return <XCircle size={16} className="text-gray-500" />;
      case ViolationAction.WARNED:
        return <Clock size={16} className="text-yellow-500" />;
      case ViolationAction.DEACTIVATED:
        return <XCircle size={16} className="text-red-500" />;
      case ViolationAction.REVOKED:
        return <XCircle size={16} className="text-red-700" />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.push('/admin/users')} className={styles.backButton}>
          <ArrowLeft size={16} />
          Quay lại
        </button>
        <div className={styles.titleSection}>
          <h1 className={styles.pageTitle}>
            <ShieldAlert size={24} />
            Lịch sử xử lý vi phạm
          </h1>
          <p className={styles.pageSubtitle}>
            Danh sách các vi phạm đã được xử lý
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.segmented} role="tablist" aria-label="Lọc hành động xử lý">
          {ACTION_OPTIONS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              className={`${styles.segment} ${actionFilter === option.value ? styles.segmentActive : ''}`}
              onClick={() => handleFilterChange(option.value)}
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
      ) : violations.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={64} />}
          title="Chưa có vi phạm nào được xử lý"
          description="Các vi phạm đã được xử lý sẽ xuất hiện tại đây."
        />
      ) : (
        <>
          <div className={styles.violationList}>
            {violations.map((violation) => (
              <ViolationCard
                key={violation.id}
                violation={violation}
                showUser
                showActions={false}
                isAdmin
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationWrapper}>
              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
