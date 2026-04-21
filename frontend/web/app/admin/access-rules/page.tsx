'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  Search,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Table,
  Column,
  Modal,
  Badge,
  ConfirmDialog,
  PageHeader,
  EmptyState,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import styles from './access-rules.module.css';

interface AccessRule {
  id: string;
  documentMetadataId: string;
  documentTitle?: string;
  targetType: 'ROLE' | 'DEPARTMENT' | 'USER';
  targetId?: string; // For compatibility with local display if needed
  targetRole?: string;
  targetDepartmentId?: string;
  targetUserId?: string;
  targetName?: string;
  permission: 'READ' | 'VIEW' | string;
  grantedBy?: string;
  createdAt: string;
}

export default function AccessRulesPage() {
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [documentMetadataId, setDocumentMetadataId] = useState('');
  const [targetType, setTargetType] = useState<'ROLE' | 'DEPARTMENT' | 'USER'>('ROLE');
  const [targetId, setTargetId] = useState('');
  const [permission, setPermission] = useState<'READ' | 'VIEW'>('READ');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AccessRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Access rules don't have a list-all endpoint, so we'll show a placeholder message
      // In practice, rules are managed per-document
      setRules([]);
    } catch {
      setError('Không thể tải quy tắc truy cập.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await api.metadata.deleteAccessRule(deleteTarget.id);
      setDeleteTarget(null);
      loadRules();
    } catch {
      setError('Không thể xóa quy tắc truy cập.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!targetId.trim() || !documentMetadataId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data: any = {
        documentMetadataId: documentMetadataId.trim(),
        targetType,
        permission,
      };

      if (targetType === 'ROLE') data.targetRole = targetId.trim();
      else if (targetType === 'DEPARTMENT') data.targetDepartmentId = targetId.trim();
      else if (targetType === 'USER') data.targetUserId = targetId.trim();

      await api.metadata.createAccessRule(data);
      setModalOpen(false);
      setTargetId('');
      setDocumentMetadataId('');
      loadRules();
    } catch {
      setError('Không thể tạo quy tắc truy cập.');
    } finally {
      setSaving(false);
    }
  };

  const targetTypeOptions = [
    { value: 'ROLE', label: 'Vai trò' },
    { value: 'DEPARTMENT', label: 'Phòng ban' },
    { value: 'USER', label: 'Người dùng' },
  ];

  const permissionOptions = [
    { value: 'READ', label: 'Tải xuống (READ)' },
    { value: 'VIEW', label: 'Xem trước (VIEW)' },
  ];

  const columns: Column<AccessRule>[] = [
    {
      key: 'documentTitle',
      header: 'Tài liệu',
      render: (r) => (
        <div className={styles.docCell}>
          <Shield size={14} />
          <span>{r.documentTitle || r.documentMetadataId}</span>
        </div>
      ),
    },
    {
      key: 'targetType',
      header: 'Loại đối tượng',
      render: (r) => (
        <Badge variant="neutral">{r.targetType}</Badge>
      ),
    },
    {
      key: 'targetName',
      header: 'Đối tượng',
      render: (r) => {
        const name = r.targetName || r.targetRole || r.targetDepartmentId || r.targetUserId || 'N/A';
        return <span className={styles.targetName}>{name}</span>;
      },
    },
    {
      key: 'permission',
      header: 'Quyền',
      render: (r) => (
        <Badge variant={r.permission === 'READ' ? 'success' : 'info'}>
          {r.permission === 'READ' ? 'Tải xuống' : 'Xem trước'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (r) => new Date(r.createdAt).toLocaleDateString('vi-VN'),
    },
    {
      key: 'actions',
      header: '',
      width: '4rem',
      align: 'right',
      render: (r) => (
        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)}>
          <Trash2 size={14} />
        </Button>
      ),
    },
  ];

  const filtered = rules.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.documentTitle?.toLowerCase().includes(s) ||
      r.targetName?.toLowerCase().includes(s) ||
      r.targetId?.toLowerCase().includes(s) ||
      r.targetRole?.toLowerCase().includes(s) ||
      r.targetDepartmentId?.toLowerCase().includes(s) ||
      r.targetUserId?.toLowerCase().includes(s)
    );
  });

  return (
    <MainLayout>
      <div className={styles.container}>
        <PageHeader
          title="Quy tắc truy cập"
          description="Quản lý quyền truy cập tài liệu cho từng vai trò, phòng ban hoặc người dùng."
          actions={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              Thêm quy tắc
            </Button>
          }
        />

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={24} className={styles.spinner} />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<Shield size={32} />}
            title="Chưa có quy tắc truy cập"
            description="Quy tắc truy cập được quản lý thông qua trang chi tiết tài liệu."
            action={
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
                Thêm quy tắc đầu tiên
              </Button>
            }
          />
        ) : (
          <>
            <div className={styles.filters}>
              <Input
                placeholder="Tìm kiếm tài liệu, đối tượng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
                inputSize="sm"
                className={styles.searchInput}
              />
            </div>
            <Table columns={columns} data={filtered} keyExtractor={(r) => r.id} />
          </>
        )}

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Thêm quy tắc truy cập"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Hủy</Button>
              <Button
                variant="primary"
                loading={saving}
                onClick={handleSave}
                disabled={!targetId.trim() || !documentMetadataId.trim()}
              >
                Thêm
              </Button>
            </>
          }
        >
          <div className={styles.form}>
            <Input
              label="ID tài liệu (Metadata ID)"
              value={documentMetadataId}
              onChange={(e) => setDocumentMetadataId(e.target.value)}
              placeholder="Nhập ID tài liệu..."
              required
            />
            <Select
              label="Loại đối tượng"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as 'ROLE' | 'DEPARTMENT' | 'USER');
                setTargetId('');
              }}
              options={targetTypeOptions}
            />
            <Input
              label={
                targetType === 'ROLE' ? 'Vai trò (VD: ADMIN, MANAGER, USER)' :
                targetType === 'DEPARTMENT' ? 'ID phòng ban' :
                'ID người dùng'
              }
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={
                targetType === 'ROLE' ? 'VD: ADMIN' :
                'Nhập ID...'
              }
              required
            />
            <Select
              label="Quyền"
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'READ' | 'VIEW')}
              options={permissionOptions}
            />
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
          title="Xóa quy tắc truy cập?"
          message={`Xóa quyền "${deleteTarget?.permission}" cho "${deleteTarget?.targetName || deleteTarget?.targetId}"?`}
          confirmLabel="Xóa"
          cancelLabel="Hủy"
          variant="danger"
        />
      </div>
    </MainLayout>
  );
}
