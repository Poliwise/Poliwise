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
} from '@/components/ui';
import { useIsAdmin } from '@/store';
import { Translator } from '@/lib/i18n';
import { useLanguage } from '@/providers';
import styles from './audit-logs.module.css';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail?: string;
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
    LOGIN_SUCCESS: { label: t('admin.audit.action.login'), variant: 'success' as const },
    LOGIN_FAILED: { label: t('admin.audit.action.loginFailed'), variant: 'destructive' as const },
    LOGOUT: { label: t('admin.audit.action.logout'), variant: 'neutral' as const },
    PASSWORD_CHANGE: { label: t('admin.audit.action.passwordChange'), variant: 'warning' as const },
    USER_CREATE: { label: t('admin.audit.action.userCreate'), variant: 'info' as const },
    USER_UPDATE: { label: t('admin.audit.action.userUpdate'), variant: 'info' as const },
    USER_PROFILE_UPDATE: { label: t('admin.audit.action.profileUpdate'), variant: 'info' as const },
    USER_DEACTIVATE: { label: t('admin.audit.action.userDeactivate'), variant: 'warning' as const },
    USER_ACTIVATE: { label: t('admin.audit.action.userActivate'), variant: 'success' as const },
    USER_REVOKE: { label: t('admin.audit.action.userRevoke'), variant: 'warning' as const },
    USER_DELETE: { label: t('admin.audit.action.userDelete'), variant: 'destructive' as const },
    ROLE_CHANGE: { label: t('admin.audit.action.roleChange'), variant: 'warning' as const },
    STATUS_CHANGE: { label: t('admin.audit.action.statusChange'), variant: 'warning' as const },
    DOCUMENT_UPLOAD: { label: t('admin.audit.action.docUpload'), variant: 'info' as const },
    DOCUMENT_DELETE: { label: t('admin.audit.action.docDelete'), variant: 'destructive' as const },
    DOCUMENT_UPDATE: { label: t('admin.audit.action.docUpdate'), variant: 'info' as const },
    DOCUMENT_PUBLISH: { label: t('admin.audit.action.docPublish'), variant: 'info' as const },
    DOCUMENT_ARCHIVE: { label: t('admin.audit.action.docArchive'), variant: 'neutral' as const },
    DOCUMENT_VERSION_CREATE: { label: t('admin.audit.action.docVersionCreate'), variant: 'info' as const },
    QUESTION_ASK: { label: t('admin.audit.action.questionAsk'), variant: 'info' as const },
    CONVERSATION_CREATE: { label: t('admin.audit.action.conversationCreate'), variant: 'info' as const },
    CONVERSATION_DELETE: { label: t('admin.audit.action.conversationDelete'), variant: 'destructive' as const },
    FEEDBACK_SUBMIT: { label: t('admin.audit.action.feedbackSubmit'), variant: 'info' as const },
    SETTINGS_UPDATE: { label: t('admin.audit.action.settingsChange'), variant: 'warning' as const },
    USER_SETTINGS_UPDATE: { label: t('admin.audit.action.userSettingsUpdate'), variant: 'warning' as const },
    CATEGORY_CREATE: { label: t('admin.audit.action.categoryCreate'), variant: 'info' as const },
    CATEGORY_UPDATE: { label: t('admin.audit.action.categoryUpdate'), variant: 'info' as const },
    CATEGORY_DELETE: { label: t('admin.audit.action.categoryDelete'), variant: 'destructive' as const },
    TAG_CREATE: { label: t('admin.audit.action.tagCreate'), variant: 'info' as const },
    TAG_UPDATE: { label: t('admin.audit.action.tagUpdate'), variant: 'info' as const },
    TAG_DELETE: { label: t('admin.audit.action.tagDelete'), variant: 'destructive' as const },
    DEPARTMENT_CREATE: { label: t('admin.audit.action.departmentCreate'), variant: 'info' as const },
    DEPARTMENT_UPDATE: { label: t('admin.audit.action.departmentUpdate'), variant: 'info' as const },
    DEPARTMENT_DELETE: { label: t('admin.audit.action.departmentDelete'), variant: 'destructive' as const },
    BULK_IMPORT: { label: t('admin.audit.action.bulkImport'), variant: 'info' as const },
    REPORT_EXPORT: { label: t('admin.audit.action.reportExport'), variant: 'info' as const },
    ONLYOFFICE_LOCK_ACQUIRED: { label: 'Khóa chỉnh sửa', variant: 'info' as const },
    ONLYOFFICE_LOCK_RELEASED: { label: 'Mở khóa chỉnh sửa', variant: 'neutral' as const },
    ONLYOFFICE_LOCK_EXTENDED: { label: 'Gia hạn khóa chỉnh sửa', variant: 'neutral' as const },
    ONLYOFFICE_LOCK_EXPIRED: { label: 'Khóa hết hạn', variant: 'warning' as const },
    ONLYOFFICE_CONFLICT_DETECTED: { label: 'Phát hiện xung đột phiên bản', variant: 'warning' as const },
    ONLYOFFICE_CONFLICT_RESOLVED: { label: 'Giải quyết xung đột', variant: 'info' as const },
    ONLYOFFICE_SAVE_SUCCESS: { label: 'Lưu OnlyOffice thành công', variant: 'success' as const },
    ONLYOFFICE_MANUAL_SAVE: { label: 'Lưu thủ công OnlyOffice', variant: 'info' as const },
    ONLYOFFICE_FORCESAVE_TRIGGERED: { label: 'Tự động lưu OnlyOffice', variant: 'info' as const },
    ONLYOFFICE_VERSION_DELETED: { label: 'Xóa phiên bản OnlyOffice', variant: 'destructive' as const },
  };
}

interface BackendAuditLog {
  id: string;
  userId: string;
  username: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  ipAddress?: string;
  createdAt: string;
}

function mapBackendToAuditLog(backend: BackendAuditLog): AuditLog {
  return {
    id: backend.id,
    timestamp: backend.createdAt,
    userId: backend.userId,
    userName: backend.username,
    action: backend.action,
    resourceType: backend.resourceType,
    resourceId: backend.resourceId,
    resourceName: backend.resourceName,
    ipAddress: backend.ipAddress || '-',
    status: 'SUCCESS',
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
      const { api } = await import('@/lib/api');
      const response = await api.audit.search({
        page: currentPage - 1,
        limit: 20,
        action: currentActionFilter || undefined,
        search: currentSearch || undefined,
      });
      const backendLogs = (response.data as unknown as BackendAuditLog[]) || [];
      setLogs(backendLogs.map(mapBackendToAuditLog));
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
    { value: 'LOGIN_SUCCESS', label: t('admin.audit.action.login') },
    { value: 'LOGIN_FAILED', label: t('admin.audit.action.loginFailed') },
    { value: 'PASSWORD_CHANGE', label: t('admin.audit.action.passwordChange') },
    { value: 'USER_PROFILE_UPDATE', label: t('admin.audit.action.profileUpdate') },
    { value: 'ROLE_CHANGE', label: t('admin.audit.action.roleChange') },
    { value: 'STATUS_CHANGE', label: t('admin.audit.action.statusChange') },
    { value: 'USER_CREATE', label: t('admin.audit.action.userCreate') },
    { value: 'USER_UPDATE', label: t('admin.audit.action.userUpdate') },
    { value: 'USER_DEACTIVATE', label: t('admin.audit.action.userDeactivate') },
    { value: 'USER_ACTIVATE', label: t('admin.audit.action.userActivate') },
    { value: 'USER_REVOKE', label: t('admin.audit.action.userRevoke') },
    { value: 'USER_DELETE', label: t('admin.audit.action.userDelete') },
    { value: 'DOCUMENT_UPLOAD', label: t('admin.audit.action.docUpload') },
    { value: 'DOCUMENT_UPDATE', label: t('admin.audit.action.docUpdate') },
    { value: 'DOCUMENT_DELETE', label: t('admin.audit.action.docDelete') },
    { value: 'DOCUMENT_PUBLISH', label: t('admin.audit.action.docPublish') },
    { value: 'DOCUMENT_ARCHIVE', label: t('admin.audit.action.docArchive') },
    { value: 'DOCUMENT_VERSION_CREATE', label: t('admin.audit.action.docVersionCreate') },
    { value: 'SETTINGS_UPDATE', label: t('admin.audit.action.settingsChange') },
    { value: 'CATEGORY_CREATE', label: t('admin.audit.action.categoryCreate') },
    { value: 'CATEGORY_UPDATE', label: t('admin.audit.action.categoryUpdate') },
    { value: 'CATEGORY_DELETE', label: t('admin.audit.action.categoryDelete') },
    { value: 'TAG_CREATE', label: t('admin.audit.action.tagCreate') },
    { value: 'TAG_UPDATE', label: t('admin.audit.action.tagUpdate') },
    { value: 'TAG_DELETE', label: t('admin.audit.action.tagDelete') },
    { value: 'DEPARTMENT_CREATE', label: t('admin.audit.action.departmentCreate') },
    { value: 'DEPARTMENT_UPDATE', label: t('admin.audit.action.departmentUpdate') },
    { value: 'DEPARTMENT_DELETE', label: t('admin.audit.action.departmentDelete') },
    { value: 'BULK_IMPORT', label: t('admin.audit.action.bulkImport') },
    { value: 'REPORT_EXPORT', label: t('admin.audit.action.reportExport') },
    { value: 'QUESTION_ASK', label: t('admin.audit.action.questionAsk') },
    { value: 'CONVERSATION_CREATE', label: t('admin.audit.action.conversationCreate') },
    { value: 'CONVERSATION_DELETE', label: t('admin.audit.action.conversationDelete') },
    { value: 'FEEDBACK_SUBMIT', label: t('admin.audit.action.feedbackSubmit') },
    { value: 'ONLYOFFICE_LOCK_ACQUIRED', label: 'Khóa chỉnh sửa' },
    { value: 'ONLYOFFICE_LOCK_RELEASED', label: 'Mở khóa chỉnh sửa' },
    { value: 'ONLYOFFICE_LOCK_EXTENDED', label: 'Gia hạn khóa' },
    { value: 'ONLYOFFICE_LOCK_EXPIRED', label: 'Khóa hết hạn' },
    { value: 'ONLYOFFICE_CONFLICT_DETECTED', label: 'Phát hiện xung đột' },
    { value: 'ONLYOFFICE_CONFLICT_RESOLVED', label: 'Giải quyết xung đột' },
    { value: 'ONLYOFFICE_SAVE_SUCCESS', label: 'Lưu OnlyOffice' },
    { value: 'ONLYOFFICE_VERSION_DELETED', label: 'Xóa phiên bản OnlyOffice' },
  ];

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: t('admin.audit.table.time'),
      width: '10rem',
      render: (log) => (
        <span className={styles.timestamp}>
          {formatDate(log.timestamp)}
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
    <div className={styles.pageWrapper}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <div>
            <h1 className={styles.pageTitle}>{t('admin.audit.title')}</h1>
            <p className={styles.pageSubtitle}>{t('admin.audit.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.pageBody}>
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
      </div>

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
              <span className={styles.detailValue}>{selectedLog.userName}</span>
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
  );
}
