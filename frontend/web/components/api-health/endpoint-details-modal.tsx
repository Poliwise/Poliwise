'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal/Modal';
import type { ApiMetricsResponse, ApiEndpointMetrics } from '@/types';
import styles from './endpoint-details-modal.module.css';

interface EndpointDetailsModalProps {
  open: boolean;
  onClose: () => void;
  metrics: ApiMetricsResponse | null;
}

interface EndpointRowProps {
  endpoint: ApiEndpointMetrics;
}

function EndpointRow({ endpoint }: EndpointRowProps) {
  const [expanded, setExpanded] = useState(false);
  const successRate =
    endpoint.total > 0
      ? Math.round((endpoint.success / endpoint.total) * 100)
      : 100;

  const getRowColor = () => {
    if (endpoint.failure === 0) return '#22c55e';
    if (successRate >= 90) return '#f59e0b';
    return '#ef4444';
  };

  const color = getRowColor();

  return (
    <>
      <tr
        className={styles.tr}
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: endpoint.recentErrors.length > 0 ? 'pointer' : 'default' }}
      >
        <td className={styles.td}>
          <span className={styles.path}>{endpoint.path}</span>
        </td>
        <td className={styles.td}>
          <span className={styles.total}>{endpoint.total.toLocaleString()}</span>
        </td>
        <td className={styles.td}>
          <span className={styles.success} style={{ color: '#22c55e' }}>
            <CheckCircle size={14} />
            {endpoint.success.toLocaleString()}
          </span>
        </td>
        <td className={styles.td}>
          {endpoint.failure > 0 ? (
            <span className={styles.failure} style={{ color: '#ef4444' }}>
              <XCircle size={14} />
              {endpoint.failure.toLocaleString()}
            </span>
          ) : (
            <span className={styles.noErrors}>
              <CheckCircle size={14} />
              0
            </span>
          )}
        </td>
        <td className={styles.td}>
          <div className={styles.rateCell}>
            <div className={styles.barBg}>
              <div
                className={styles.barFill}
                style={{ width: `${successRate}%`, background: color }}
              />
            </div>
            <span className={styles.rateValue} style={{ color }}>
              {successRate}%
            </span>
          </div>
        </td>
        <td className={styles.td}>
          <span className={styles.responseTime}>
            <Clock size={14} />
            {endpoint.avgResponseTime}ms
          </span>
        </td>
        <td className={styles.td}>
          {endpoint.recentErrors.length > 0 ? (
            <button
              className={styles.expandBtn}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && endpoint.recentErrors.length > 0 && (
        <tr className={styles.expandedRow}>
          <td colSpan={7} className={styles.expandedCell}>
            <div className={styles.errorsList}>
              <span className={styles.errorsTitle}>Lỗi gần đây</span>
              {endpoint.recentErrors.map((err, i) => (
                <div key={i} className={styles.errorItem}>
                  <span className={styles.errorTime}>
                    {new Date(err.timestamp).toLocaleString('vi-VN')}
                  </span>
                  <span className={styles.errorMethod}>{err.method}</span>
                  <span
                    className={styles.errorStatus}
                    style={{ color: err.statusCode >= 500 ? '#ef4444' : err.statusCode >= 400 ? '#f59e0b' : '#6b7280' }}
                  >
                    {err.statusCode}
                  </span>
                  <span className={styles.errorPath}>{err.path}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function EndpointDetailsModal({
  open,
  onClose,
  metrics,
}: EndpointDetailsModalProps) {
  if (!metrics) return null;

  const { overall, endpoints } = metrics;
  const sorted = [...endpoints].sort((a, b) => b.failure - a.failure);

  return (
    <Modal open={open} onClose={onClose} title="Chi tiết Endpoint" size="xl">
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Tổng requests</span>
          <span className={styles.summaryValue}>{overall.totalRequests.toLocaleString()}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Thành công</span>
          <span className={styles.summaryValue} style={{ color: '#22c55e' }}>
            {(overall.totalRequests - overall.totalErrors).toLocaleString()}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Lỗi</span>
          <span className={styles.summaryValue} style={{ color: '#ef4444' }}>
            {overall.totalErrors.toLocaleString()}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Success rate</span>
          <span
            className={styles.summaryValue}
            style={{
              color:
                overall.successRate >= 99
                  ? '#22c55e'
                  : overall.successRate >= 95
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          >
            {overall.successRate}%
          </span>
        </div>
      </div>

      {endpoints.length === 0 ? (
        <div className={styles.empty}>
          <AlertCircle size={32} />
          <span>Chưa có dữ liệu endpoint</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead}>
                <th className={styles.th}>Endpoint</th>
                <th className={styles.th}>Tổng</th>
                <th className={styles.th}>Thành công</th>
                <th className={styles.th}>Lỗi</th>
                <th className={styles.th}>Success rate</th>
                <th className={styles.th}>Avg response</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ep, i) => (
                <EndpointRow key={i} endpoint={ep} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
