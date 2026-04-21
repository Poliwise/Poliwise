'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  Download,
  Upload,
  Grid,
  List,
  Tag,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  Button,
  Input,
  Select,
  Badge,
  Card,
  Pagination,
  EmptyState,
  Spinner,
} from '@/components/ui';
import { UploadModal } from '@/components/documents/UploadModal';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import { Document, DocumentStatus } from '@/types';
import styles from './documents.module.css';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; variant: 'success' | 'warning' | 'neutral' | 'destructive' }> = {
  [DocumentStatus.PUBLISHED]: { label: 'Đã xuất bản', variant: 'success' },
  [DocumentStatus.DRAFT]: { label: 'Nháp', variant: 'warning' },
  [DocumentStatus.ARCHIVED]: { label: 'Đã lưu trữ', variant: 'neutral' },
  [DocumentStatus.EXPIRED]: { label: 'Hết hạn', variant: 'destructive' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: DocumentStatus.PUBLISHED, label: 'Đã xuất bản' },
  { value: DocumentStatus.DRAFT, label: 'Nháp' },
  { value: DocumentStatus.ARCHIVED, label: 'Đã lưu trữ' },
  { value: DocumentStatus.EXPIRED, label: 'Hết hạn' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.documents.getAll({
        page,
        limit: 12,
        search: search || undefined,
        status: (statusFilter as DocumentStatus) || undefined,
      });
      setDocuments(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDownload = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await api.documents.download(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1>Kho tài liệu</h1>
            <p>{total > 0 ? `${total} tài liệu` : 'Tìm kiếm và quản lý tài liệu'}</p>
          </div>
          {isAdmin && (
            <Button
              variant="primary"
              icon={<Upload size={16} />}
              onClick={() => setUploadModalOpen(true)}
            >
              Tải lên
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <Input
            placeholder="Tìm kiếm tài liệu..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            leftIcon={<Search size={18} />}
            inputSize="sm"
            className={styles.searchInput}
          />

          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={STATUS_OPTIONS}
            selectSize="sm"
            className={styles.statusSelect}
          />

          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Document Grid/List */}
        {loading ? (
          <div className={styles.loading}>
            <Spinner size="lg" label="Đang tải tài liệu..." />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} />}
            title="Không tìm thấy tài liệu"
            description={search || statusFilter ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : 'Tải lên tài liệu đầu tiên để bắt đầu'}
            action={
              isAdmin ? (
                <Button variant="primary" icon={<Upload size={16} />} onClick={() => setUploadModalOpen(true)}>
                  Tải lên tài liệu
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={viewMode === 'grid' ? styles.grid : styles.list}>
            {documents.map((doc) => {
              const status = STATUS_CONFIG[doc.status];
              return (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  className={clsx(styles.docCardWrapper, viewMode === 'list' && styles.listWrapper)}
                >
                  <Card
                    padding="md"
                    className={clsx(styles.docCard, viewMode === 'list' && styles.listCard)}
                  >
                    <div className={styles.docIcon}>
                      <FileText size={24} />
                    </div>
                    <div className={styles.docInfo}>
                      <div className={styles.docTitleRow}>
                        <h3 className={styles.docTitle}>{doc.title}</h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      {doc.description && (
                        <p className={styles.docDesc}>{doc.description}</p>
                      )}
                      <div className={styles.docMeta}>
                        <span className={styles.metaItem}>{formatFileSize(doc.fileSize)}</span>
                        {doc.uploadedAt && (
                          <span className={styles.metaItem}>
                            {new Date(doc.uploadedAt).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                        {doc.version > 1 && (
                          <Badge variant="neutral">v{doc.version}</Badge>
                        )}
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className={styles.tags}>
                          {doc.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={styles.tag}>
                              <Tag size={11} />
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className={styles.tagMore}>+{doc.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.docActions}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDownload(doc, e)}
                        title="Tải xuống"
                      >
                        <Download size={16} />
                      </Button>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}

        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            setUploadModalOpen(false);
            loadDocuments();
          }}
        />
      </div>
    </MainLayout>
  );
}
