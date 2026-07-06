'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ArrowLeft, Filter } from 'lucide-react';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';
import {
  Spinner,
  EmptyState,
  Pagination,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { WarningCard } from '@/components/violations';
import { Warning } from '@/types/violation';
import styles from './violations.module.css';

type ReadFilter = '' | 'read' | 'unread';

export default function UserWarningsPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [readFilter, setReadFilter] = useState<ReadFilter>('');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const limit = 10;

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadWarnings();
  }, [_hasHydrated, isAuthenticated, currentPage, readFilter]);

  const loadWarnings = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: {
        page: number;
        limit: number;
        read?: boolean;
      } = {
        page: currentPage,
        limit,
      };

      if (readFilter === 'read') {
        params.read = true;
      } else if (readFilter === 'unread') {
        params.read = false;
      }

      const response = await api.violations.getMyWarnings(params);
      setWarnings(response.data as Warning[]);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load warnings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, readFilter]);

  const handleAcknowledge = async (warning: Warning) => {
    try {
      setAcknowledgingId(warning.id);
      await api.violations.acknowledgeWarning(warning.id);
      await loadWarnings();
    } catch (error) {
      console.error('Failed to acknowledge warning:', error);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleReadFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setReadFilter(e.target.value as ReadFilter);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            onClick={() => router.push('/')}
            className={styles.backButton}
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>
              <Bell size={24} />
              Cảnh báo
            </h1>
            <p className={styles.pageSubtitle}>
              Xem các cảnh báo bạn đã nhận được
            </p>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <select
              value={readFilter}
              onChange={handleReadFilterChange}
              className={styles.statusSelect}
            >
              <option value="">Tất cả</option>
              <option value="unread">Chưa đọc</option>
              <option value="read">Đã đọc</option>
            </select>
          </div>
          <div className={styles.stats}>
            <span className={styles.statItem}>
              <Bell size={16} />
              Tổng: {totalItems}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Spinner />
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : warnings.length === 0 ? (
          <EmptyState
            icon={<Bell size={48} />}
            title="Không có cảnh báo nào"
            description="Bạn chưa nhận được cảnh báo nào."
          />
        ) : (
          <>
            <div className={styles.warningList}>
              {warnings.map((warning) => (
                <WarningCard
                  key={warning.id}
                  warning={warning}
                  onAcknowledge={handleAcknowledge}
                  isAcknowledging={acknowledgingId === warning.id}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
