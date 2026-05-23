'use client';

import React from 'react';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { ApiMetricsResponse } from '@/types';
import styles from './api-health-card.module.css';

interface ApiHealthCardProps {
  metrics: ApiMetricsResponse | null;
  loading: boolean;
  onClick: () => void;
}

export function ApiHealthCard({ metrics, loading, onClick }: ApiHealthCardProps) {
  if (loading) {
    return (
      <Card padding="md" className={styles.card}>
        <div className={styles.inner}>
          <div className={styles.iconWrap} style={{ background: 'rgba(107, 114, 128, 0.1)', color: 'var(--muted-foreground)' }}>
            <Activity size={22} />
          </div>
          <div className={styles.content}>
            <span className={styles.label}>API Health</span>
            <span className={styles.loading}>Đang tải...</span>
          </div>
        </div>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card padding="md" className={styles.card} onClick={onClick} style={{ cursor: 'pointer' }}>
        <div className={styles.inner}>
          <div className={styles.iconWrap} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertCircle size={22} />
          </div>
          <div className={styles.content}>
            <span className={styles.label}>API Health</span>
            <span className={styles.subValue}>Không có dữ liệu</span>
          </div>
        </div>
      </Card>
    );
  }

  const { overall, endpoints } = metrics;
  const errorCount = overall.totalErrors;
  const successRate = overall.successRate;
  const failedEndpoints = endpoints.filter((e) => e.failure > 0).length;

  const getHealthStatus = () => {
    if (successRate >= 99) return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: <CheckCircle size={22} /> };
    if (successRate >= 95) return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: <AlertCircle size={22} /> };
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: <XCircle size={22} /> };
  };

  const status = getHealthStatus();

  return (
    <Card
      padding="md"
      className={styles.card}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.inner}>
        <div className={styles.iconWrap} style={{ background: status.bg, color: status.color }}>
          {status.icon}
        </div>
        <div className={styles.content}>
          <span className={styles.label}>API Health</span>
          <div className={styles.row}>
            <span className={styles.mainValue} style={{ color: status.color }}>
              {successRate}%
            </span>
            <span className={styles.separator}>/</span>
            <span className={styles.subValue}>
              {errorCount} lỗi
              {failedEndpoints > 0 && (
                <span className={styles.badge}>
                  {failedEndpoints} endpoint{failedEndpoints > 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>
          <span className={styles.meta}>
            {overall.totalRequests.toLocaleString()} tổng requests
          </span>
        </div>
        <div className={styles.arrow}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Card>
  );
}
