'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  Edit2,
  Trash2,
  Tag as TagIcon,
} from 'lucide-react';
import {
  Button,
  Input,
  Table,
  Column,
  Modal,
  Badge,
  EmptyState,
  ConfirmDialog,
  PageHeader,
} from '@/components/ui';
import { api } from '@/lib/api';
import styles from './tags.module.css';

interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  usageCount?: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const data = await api.metadata.getTags();
      setTags(data as unknown as Tag[]);
    } catch {
      setActionError('Không thể tải danh sách nhãn.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const openCreate = () => {
    setEditing(null);
    setTagName('');
    setModalOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setTagName(tag.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!tagName.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      if (editing) {
        await api.metadata.updateTag(editing.id, { name: tagName.trim() });
      } else {
        await api.metadata.createTag({ name: tagName.trim() });
      }
      setModalOpen(false);
      loadTags();
    } catch {
      setActionError('Không thể lưu nhãn.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.metadata.deleteTag(deleteTarget.id);
      setDeleteTarget(null);
      loadTags();
    } catch {
      setActionError('Không thể xóa nhãn.');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Tag>[] = [
    {
      key: 'name',
      header: 'Tên nhãn',
      render: (tag) => (
        <div className={styles.tagName}>
          <TagIcon size={14} />
          <span>{tag.name}</span>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (tag) => <code className={styles.slug}>{tag.slug}</code>,
    },
    {
      key: 'usageCount',
      header: 'Sử dụng',
      align: 'center',
      render: (tag) => (
        <Badge variant="neutral">{tag.usageCount ?? 0}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '6rem',
      align: 'right',
      render: (tag) => (
        <div className={styles.rowActions}>
          <Button variant="ghost" size="icon" onClick={() => openEdit(tag)}>
            <Edit2 size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(tag)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Nhãn"
        description="Quản lý nhãn phân loại tài liệu."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
            Thêm nhãn
          </Button>
        }
      />

      {actionError && <div className={styles.error}>{actionError}</div>}

      {loading ? (
        <div className={styles.loading}>
          <Loader2 size={24} className={styles.spinner} />
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon size={32} />}
          title="Chưa có nhãn nào"
          description="Tạo nhãn đầu tiên để gắn vào tài liệu."
          action={<Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>Tạo nhãn</Button>}
        />
      ) : (
        <Table columns={columns} data={tags} keyExtractor={(t) => t.id} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Chỉnh sửa nhãn' : 'Tạo nhãn mới'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={saving} onClick={handleSave} disabled={!tagName.trim()}>
              {editing ? 'Lưu' : 'Tạo'}
            </Button>
          </>
        }
      >
        <Input
          label="Tên nhãn"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          placeholder="VD: HR, Finance, IT..."
          required
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Xóa nhãn?"
        message={`Xóa nhãn "${deleteTarget?.name}"? Nhãn sẽ được gỡ khỏi tất cả tài liệu.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />
    </div>
  );
}
