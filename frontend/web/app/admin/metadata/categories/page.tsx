'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  Edit2,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Table,
  Column,
  Modal,
  Badge,
  EmptyState,
  ConfirmDialog,
  PageHeader,
} from '@/components/ui';
import { api } from '@/lib/api';
import styles from './categories.module.css';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  documentCount?: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const data = await api.metadata.getCategories();
      setCategories(data as unknown as Category[]);
    } catch {
      setActionError('Không thể tải danh sách danh mục.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', slug: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setFormData({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      if (editing) {
        await api.metadata.updateCategory(editing.id, {
          name: formData.name.trim(),
          slug: formData.slug.trim() || undefined,
          description: formData.description.trim() || undefined,
        });
      } else {
        await api.metadata.createCategory({
          name: formData.name.trim(),
          slug: formData.slug.trim() || undefined,
          description: formData.description.trim() || undefined,
        });
      }
      setModalOpen(false);
      loadCategories();
    } catch {
      setActionError('Không thể lưu danh mục.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.metadata.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      loadCategories();
    } catch {
      setActionError('Không thể xóa danh mục.');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Tên danh mục',
      render: (cat) => (
        <div className={styles.catName}>
          <FolderOpen size={16} />
          <span>{cat.name}</span>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (cat) => <code className={styles.slug}>{cat.slug}</code>,
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (cat) => (
        <span className={styles.desc}>{cat.description || '-'}</span>
      ),
    },
    {
      key: 'documentCount',
      header: 'Tài liệu',
      align: 'center',
      render: (cat) => (
        <Badge variant="neutral">{cat.documentCount ?? 0}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '6rem',
      align: 'right',
      render: (cat) => (
        <div className={styles.rowActions}>
          <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
            <Edit2 size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cat)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Danh mục"
        description="Quản lý danh mục tài liệu."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
            Thêm danh mục
          </Button>
        }
      />

      {actionError && (
        <div className={styles.error}>{actionError}</div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <Loader2 size={24} className={styles.spinner} />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={32} />}
          title="Chưa có danh mục nào"
          description="Tạo danh mục đầu tiên để phân loại tài liệu."
          action={<Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>Tạo danh mục</Button>}
        />
      ) : (
        <Table columns={columns} data={categories} keyExtractor={(c) => c.id} />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={saving} onClick={handleSave} disabled={!formData.name.trim()}>
              {editing ? 'Lưu' : 'Tạo'}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label="Tên danh mục"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="VD: Chính sách nhân sự"
            required
          />
          <Input
            label="Slug"
            value={formData.slug}
            onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
            placeholder="Tu dong tao neu de trong"
            helperText="VD: hr-policies (dể trống để tự động tạo)"
          />
          <Textarea
            label="Mô tả"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            placeholder="Mô tả ngắn về danh mục này..."
            rows={3}
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Xóa danh mục?"
        message={`Xóa "${deleteTarget?.name}"? Tài liệu trong danh mục này sẽ không bị xóa.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
      />
    </div>
  );
}
