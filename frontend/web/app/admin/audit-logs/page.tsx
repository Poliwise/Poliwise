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
import { Translator } from '@/lib/i18n';
import { useLanguage } from '@/providers';
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

function getActionConfig(t: Translator) {
  return {
    LOGIN: { label: t('admin.audit.action.login'), variant: 'success' as const },
    LOGOUT: { label: t('admin.audit.action.logout'), variant: 'neutral' as const },
    LOGOUT_ALL: { label: t('admin.audit.action.logoutAll'), variant: 'warning' as const },
    CREATE: { label: t('admin.audit.action.create'), variant: 'info' as const },
    UPDATE: { label: t('admin.audit.action.update'), variant: 'info' as const },
    DELETE: { label: t('admin.audit.action.delete'), variant: 'destructive' as const },
    PASSWORD_CHANGE: { label: t('admin.audit.action.passwordChange'), variant: 'warning' as const },
    ROLE_CHANGE: { label: t('admin.audit.action.roleChange'), variant: 'warning' as const },
    STATUS_CHANGE: { label: t('admin.audit.action.statusChange'), variant: 'warning' as const },
    DOCUMENT_UPLOAD: { label: t('admin.audit.action.docUpload'), variant: 'info' as const },
    DOCUMENT_DELETE: { label: t('admin.audit.action.docDelete'), variant: 'destructive' as const },
    REPORT_EXPORT: { label: t('admin.audit.action.reportExport'), variant: 'info' as const },
    SETTINGS_CHANGE: { label: t('admin.audit.action.settingsChange'), variant: 'warning' as const },
    ONLYOFFICE_LOCK_ACQUIRED: { label: 'Khóa chỉnh sửa', variant: 'info' as const },
    ONLYOFFICE_LOCK_RELEASED: { label: 'Mở khóa chỉnh sửa', variant: 'neutral' as const },
    ONLYOFFICE_LOCK_EXTENDED: { label: 'Gia hạn khóa chỉnh sửa', variant: 'neutral' as const },
    ONLYOFFICE_LOCK_EXPIRED: { label: 'Khóa hết hạn', variant: 'warning' as const },
    ONLYOFFICE_CONFLICT_DETECTED: { label: 'Phát hiện xung đột phiên bản', variant: 'warning' as const },
    ONLYOFFICE_CONFLICT_RESOLVED: { label: 'Giải quyết xung đột', variant: 'info' as const },
    ONLYOFFICE_SAVE_SUCCESS: { label: 'Lưu OnlyOffice thành công', variant: 'success' as const },
    ONLYOFFICE_VERSION_DELETED: { label: 'Xóa phiên bản OnlyOffice', variant: 'destructive' as const },
  };
}

export default function AuditLogsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { t } = useLanguage();
  const ACTION_CONFIG = getActionConfig(t);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async (currentPage: number, currentSearch: string, currentActionFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.audit.search({
        page: currentPage,
        limit: 20,
        action: currentActionFilter || undefined,
        search: currentSearch || undefined,
      });
      setLogs(response.data as unknown as AuditLog[]);
      setTotalPages(response.pagination?.totalPages ?? 1);
    } catch {
      setError(t('admin.audit.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadLogs(page, search, actionFilter);
  }, [isAdmin, router, page, search, actionFilter, loadLogs]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActionChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  const actionOptions = [
    { value: '', label: t('admin.audit.filter.allActions') },
    { value: 'LOGIN', label: t('admin.audit.action.login') },
    { value: 'LOGOUT', label: t('admin.audit.action.logout') },
    { value: 'CREATE', label: t('admin.audit.action.create') },
    { value: 'UPDATE', label: t('admin.audit.action.update') },
    { value: 'DELETE', label: t('admin.audit.action.delete') },
    { value: 'PASSWORD_CHANGE', label: t('admin.audit.action.passwordChange') },
    { value: 'ROLE_CHANGE', label: t('admin.audit.action.roleChange') },
    { value: 'STATUS_CHANGE', label: t('admin.audit.action.statusChange') },
    { value: 'DOCUMENT_UPLOAD', label: t('admin.audit.action.docUpload') },
    { value: 'DOCUMENT_DELETE', label: t('admin.audit.action.docDelete') },
    { value: 'REPORT_EXPORT', label: t('admin.audit.action.reportExport') },
    { value: 'ONLYOFFICE_LOCK_ACQUIRED', label: 'Khóa chỉnh sửa' },
    { value: 'ONLYOFFICE_LOCK_RELEASED', label: 'Mở khóa chỉnh sửa' },
    { value: 'ONLYOFFICE_CONFLICT_DETECTED', label: 'Phát hiện xung đột' },
    { value: 'ONLYOFFICE_CONFLICT_RESOLVED', label: 'Giải quyết xung đột' },
    { value: 'ONLYOFFICE_SAVE_SUCCESS', label: 'Lưu OnlyOffice thành công' },
    { value: 'ONLYOFFICE_VERSION_DELETED', label: 'Xóa phiên bản OnlyOffice' },
  ];

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: t('admin.audit.table.time'),
      width: '10rem',
      render: (log) => (
        <span className={styles.timestamp}>
          {new Date(log.timestamp).toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      key: 'userName',
      header: t('admin.audit.table.user'),
      render: (log) => (
        <div className={styles.userCell}>
          <User size={14} />
          <span>{log.userName}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: t('admin.audit.table.action'),
      render: (log) => {
        const cfg = ACTION_CONFIG[log.action as keyof typeof ACTION_CONFIG];
        return (
          <Badge variant={cfg?.variant ?? 'neutral'}>
            {cfg?.label ?? log.action}
          </Badge>
        );
      },
    },
    {
      key: 'resourceName',
      header: t('admin.audit.table.resource'),
      render: (log) => (
        <span className={styles.resourceText}>
          {log.resourceName || log.resourceType || '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: t('admin.audit.table.ip'),
      render: (log) => <code className={styles.ip}>{log.ipAddress}</code>,
    },
    {
      key: 'status',
      header: t('admin.audit.table.result'),
      align: 'center',
      render: (log) => (
        <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}>
          {log.status === 'SUCCESS' ? t('admin.audit.result.success') : t('admin.audit.result.failure')}
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
          title={t('admin.audit.title')}
          description={t('admin.audit.subtitle')}
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.filters}>
          <Input
            placeholder={t('admin.audit.search.placeholder')}
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
            title={t('admin.audit.empty.title')}
            description={t('admin.audit.empty.description')}
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
          title={t('admin.audit.detail.title')}
          size="sm"
          footer={<Button variant="secondary" onClick={() => setSelectedLog(null)}>{t('admin.audit.close')}</Button>}
        >
          {selectedLog && (
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('admin.audit.detail.id')}</span>
                <code className={styles.detailValue}>{selectedLog.id}</code>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('admin.audit.detail.user')}</span>
                <span className={styles.detailValue}>{selectedLog.userName} ({selectedLog.userEmail})</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('admin.audit.detail.action')}</span>
                <span className={styles.detailValue}>{selectedLog.action}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('admin.audit.detail.resource')}</span>
                <span className={styles.detailValue}>
                  {selectedLog.resourceType}{selectedLog.resourceId ? ` / ${selectedLog.resourceId}` : ''}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('admin.audit.detail.ip')}</span>
                <span className={styles.detailValue}>{selectedLog.ipAddress}</span>
              </div>
              {selectedLog.userAgent && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('admin.audit.detail.userAgent')}</span>
                  <span className={styles.detailValue}>{selectedLog.userAgent}</span>
                </div>
              )}
              {selectedLog.details && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('admin.audit.detail.details')}</span>
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
