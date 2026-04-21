'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScrollText,
  Search,
  Loader2,
  User,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Badge,
  Table,
  Column,
  Modal,
  Pagination,
  EmptyState,
  PageHeader,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import styles from './audit-logs.module.css';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  ipAddress: string;
  userAgent?: string;
  details?: string;
  status: 'SUCCESS' | 'FAILURE';
}

const ACTION_CONFIG: Partial<Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'destructive' | 'neutral' }>> = {
  LOGIN: { label: 'Đăng nhập', variant: 'success' },
  LOGOUT: { label: 'Đăng xuất', variant: 'neutral' },
  LOGOUT_ALL: { label: 'Đăng xuất tất cả', variant: 'warning' },
  CREATE: { label: 'Tạo mới', variant: 'info' },
  UPDATE: { label: 'Cập nhật', variant: 'info' },
  DELETE: { label: 'Xóa', variant: 'destructive' },
  PASSWORD_CHANGE: { label: 'Đổi mật khẩu', variant: 'warning' },
  ROLE_CHANGE: { label: 'Đổi vai trò', variant: 'warning' },
  STATUS_CHANGE: { label: 'Đổi trạng thái', variant: 'warning' },
  DOCUMENT_UPLOAD: { label: 'Tải tài liệu', variant: 'info' },
  DOCUMENT_DELETE: { label: 'Xóa tài liệu', variant: 'destructive' },
  REPORT_EXPORT: { label: 'Xuất báo cáo', variant: 'info' },
  SETTINGS_CHANGE: { label: 'Thay đổi cài đặt', variant: 'warning' },
};

export default function AuditLogsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.audit.search({
        page,
        limit: 20,
        action: actionFilter || undefined,
        search: search || undefined,
      });
      setLogs(response.data as unknown as AuditLog[]);
      setTotalPages(response.pagination?.totalPages ?? 1);
    } catch {
      setError('Không thể tải nhật ký hệ thống.');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadLogs();
  }, [isAdmin, router, loadLogs]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActionChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  const actionOptions = [
    { value: '', label: 'Tất cả hành động' },
    { value: 'LOGIN', label: 'Đăng nhập' },
    { value: 'LOGOUT', label: 'Đăng xuất' },
    { value: 'CREATE', label: 'Tạo mới' },
    { value: 'UPDATE', label: 'Cập nhật' },
    { value: 'DELETE', label: 'Xóa' },
    { value: 'PASSWORD_CHANGE', label: 'Đổi mật khẩu' },
    { value: 'ROLE_CHANGE', label: 'Đổi vai trò' },
    { value: 'STATUS_CHANGE', label: 'Đổi trạng thái' },
    { value: 'DOCUMENT_UPLOAD', label: 'Tải tài liệu' },
    { value: 'DOCUMENT_DELETE', label: 'Xóa tài liệu' },
    { value: 'REPORT_EXPORT', label: 'Xuất báo cáo' },
  ];

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Thời gian',
      width: '10rem',
      render: (log) => (
        <span className={styles.timestamp}>
          {new Date(log.timestamp).toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      key: 'userName',
      header: 'Người dùng',
      render: (log) => (
        <div className={styles.userCell}>
          <User size={14} />
          <span>{log.userName}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Hành động',
      render: (log) => {
        const cfg = ACTION_CONFIG[log.action];
        return (
          <Badge variant={cfg?.variant ?? 'neutral'}>
            {cfg?.label ?? log.action}
          </Badge>
        );
      },
    },
    {
      key: 'resourceName',
      header: 'Tài nguyên',
      render: (log) => (
        <span className={styles.resourceText}>
          {log.resourceName || log.resourceType || '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (log) => <code className={styles.ip}>{log.ipAddress}</code>,
    },
    {
      key: 'status',
      header: 'Kết quả',
      align: 'center',
      render: (log) => (
        <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}>
          {log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
        </Badge>
      ),
    },
    {
      key: 'details',
      header: '',
      width: '4rem',
      align: 'center',
      render: (log) =>
        log.details ? (
          <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
            <AlertCircle size={14} />
          </Button>
        ) : null,
    },
  ];

  return (
    <MainLayout>
      <div className={styles.container}>
        <PageHeader
          title="Nhật ký hệ thống"
          description="Theo dõi các hoạt động của người dùng trong hệ thống."
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.filters}>
          <Input
            placeholder="Tìm kiếm người dùng, tài nguyên..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            inputSize="sm"
            className={styles.searchInput}
          />
          <Select
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            options={actionOptions}
            selectSize="sm"
            className={styles.actionSelect}
          />
        </div>

        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={24} className={styles.spinner} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={32} />}
            title="Không có nhật ký"
            description="Chưa có hoạt động nào được ghi lại."
          />
        ) : (
          <>
            <Table columns={columns} data={logs} keyExtractor={(l) => l.id} />
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        <Modal
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Chi tiết nhật ký"
          size="sm"
          footer={<Button variant="secondary" onClick={() => setSelectedLog(null)}>Đóng</Button>}
        >
          {selectedLog && (
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>ID</span>
                <code className={styles.detailValue}>{selectedLog.id}</code>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Người dùng</span>
                <span className={styles.detailValue}>{selectedLog.userName} ({selectedLog.userEmail})</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Hành động</span>
                <span className={styles.detailValue}>{selectedLog.action}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Tài nguyên</span>
                <span className={styles.detailValue}>
                  {selectedLog.resourceType}{selectedLog.resourceId ? ` / ${selectedLog.resourceId}` : ''}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>IP</span>
                <span className={styles.detailValue}>{selectedLog.ipAddress}</span>
              </div>
              {selectedLog.userAgent && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>User Agent</span>
                  <span className={styles.detailValue}>{selectedLog.userAgent}</span>
                </div>
              )}
              {selectedLog.details && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Chi tiết</span>
                  <span className={styles.detailValue}>{selectedLog.details}</span>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  );
}
