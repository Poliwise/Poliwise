'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, Monitor, Globe, CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui';
import { api } from '@/lib/api';
import styles from './LoginHistoryModal.module.css';

interface LoginHistoryModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

interface LoginHistoryEntry {
  id: string;
  username: string;
  ipAddress: string;
  deviceType: string;
  location: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

interface LoginHistoryResponse {
  data: LoginHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function LoginHistoryModal({ open, onClose, userId }: LoginHistoryModalProps) {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (page: number) => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.users.getLoginHistory(userId, { page, limit: 20 });
      setHistory(result.data);
      setPagination(result.pagination);
    } catch {
      setError('Không thể tải lịch sử đăng nhập. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      loadHistory(1);
    }
  }, [open, userId, loadHistory]);

  const handlePrev = () => {
    if (pagination.page > 1) loadHistory(pagination.page - 1);
  };

  const handleNext = () => {
    if (pagination.page < pagination.totalPages) loadHistory(pagination.page + 1);
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const isSuccess = status === 'SUCCESS';
    return (
      <span className={`${styles.statusBadge} ${isSuccess ? styles.success : styles.failed}`}>
        {isSuccess ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {isSuccess ? 'Thành công' : 'Thất bại'}
      </span>
    );
  };

  const getDeviceIcon = (deviceType: string) => {
    const d = deviceType?.toLowerCase() || '';
    if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) return <Monitor size={14} className={styles.deviceIconMobile} />;
    return <Monitor size={14} className={styles.deviceIcon} />;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lịch sử đăng nhập"
      description="Các lần đăng nhập gần đây của bạn"
      size="lg"
    >
      <div className={styles.container}>
        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Đang tải lịch sử...</span>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div className={styles.empty}>
            <Clock size={40} className={styles.emptyIcon} />
            <p>Chưa có lịch sử đăng nhập</p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Địa chỉ IP</th>
                    <th>Thiết bị</th>
                    <th>Vị trí</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td className={styles.timeCell}>{formatDateTime(entry.createdAt)}</td>
                      <td className={styles.monoCell}>{entry.ipAddress || '—'}</td>
                      <td>
                        <div className={styles.deviceCell}>
                          {getDeviceIcon(entry.deviceType)}
                          <span>{entry.deviceType || 'Không xác định'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.locationCell}>
                          <MapPin size={12} />
                          <span>{entry.location || 'Không rõ'}</span>
                        </div>
                      </td>
                      <td>
                        {getStatusBadge(entry.status)}
                        {entry.status === 'FAILED' && entry.failureReason && (
                          <span className={styles.failureReason} title={entry.failureReason}>
                            {entry.failureReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={handlePrev}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft size={16} />
                Trước
              </button>
              <span className={styles.pageInfo}>
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={handleNext}
                disabled={pagination.page >= pagination.totalPages}
              >
                Sau
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default LoginHistoryModal;
