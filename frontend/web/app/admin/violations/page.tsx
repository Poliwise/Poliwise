'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuthStore, useIsAdmin } from '@/store';
import { api } from '@/lib/api';
import { Badge, EmptyState, Pagination, Spinner } from '@/components/ui';
import { ReviewModal, ViolationCard, ViolationStats } from '@/components/violations';
import { Violation, ViolationAction, ViolationSeverity, ViolationSeverityLabels } from '@/types/violation';
import styles from './admin-violations.module.css';

type SeverityFilter = '' | ViolationSeverity;

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: '', label: 'Tất cả mức độ' },
  ...Object.values(ViolationSeverity).map((severity) => ({
    value: severity,
    label: ViolationSeverityLabels[severity],
  })),
];

export default function AdminViolationsPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const isAdmin = useIsAdmin();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [stats, setStats] = useState<{
    pendingViolations: number;
    totalViolations?: number;
    totalWarnings?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);

  const limit = 10;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [violationsResponse, statsResponse] = await Promise.all([
        api.violations.getQueue({
          page: currentPage,
          limit,
          severity: severityFilter || undefined,
        }),
        api.violations.getStats(),
      ]);

      const violationsData = (violationsResponse.data as Violation[]).filter(
        (v) => v.userRole !== 'ADMIN'
      );
      setViolations(violationsData);
      setTotalItems(violationsData.length);
      setTotalPages(1);
      setStats(statsResponse);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, severityFilter]);

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
    loadData();
  }, [_hasHydrated, isAuthenticated, isAdmin, loadData, router]);

  const handleSeverityFilterChange = (value: SeverityFilter) => {
    setSeverityFilter(value);
    setCurrentPage(1);
  };

  const handleReview = (violation: Violation) => {
    setSelectedViolation(violation);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (violationId: string, action: ViolationAction) => {
    await api.violations.reviewViolation(violationId, action);
    await loadData();
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
            Hàng đợi vi phạm
          </h1>
          <p className={styles.pageSubtitle}>
            Xem xét và xử lý các vi phạm từ người dùng
          </p>
        </div>
      </div>

      {stats && (
        <div className={styles.statsSection}>
          <ViolationStats stats={stats} />
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.segmented} role="tablist" aria-label="Lọc mức độ vi phạm">
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              className={`${styles.segment} ${severityFilter === option.value ? styles.segmentActive : ''}`}
              onClick={() => handleSeverityFilterChange(option.value)}
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
          icon={<ShieldAlert size={64} />}
          title="Không có vi phạm nào"
          description="Không có vi phạm nào cần xem xét với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className={styles.violationList}>
            {violations.map((violation) => (
              <ViolationCard
                key={violation.id}
                violation={violation}
                showUser
                showActions
                isAdmin
                onReview={handleReview}
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

      <ReviewModal
        open={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedViolation(null);
        }}
        violation={selectedViolation}
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}
