'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  FileText,
  Download,
  Upload,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Tag,
  Loader2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import { Document, DocumentStatus } from '@/types';
import styles from './documents.module.css';

const statusColors: Record<DocumentStatus, { bg: string; text: string }> = {
  [DocumentStatus.PUBLISHED]: { bg: 'bg-green-100', text: 'text-green-700' },
  [DocumentStatus.DRAFT]: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  [DocumentStatus.ARCHIVED]: { bg: 'bg-gray-100', text: 'text-gray-700' },
  [DocumentStatus.EXPIRED]: { bg: 'bg-red-100', text: 'text-red-700' },
};

const statusLabels: Record<DocumentStatus, string> = {
  [DocumentStatus.PUBLISHED]: 'Đã xuất bản',
  [DocumentStatus.DRAFT]: 'Nháp',
  [DocumentStatus.ARCHIVED]: 'Đã lưu trữ',
  [DocumentStatus.EXPIRED]: 'Hết hạn',
};

export default function DocumentsPage() {
  const isAdmin = useIsAdmin();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.documents.getAll({
        page,
        limit: 12,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setDocuments(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    return <FileText size={24} />;
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Kho tài liệu</h1>
            <p className={styles.subtitle}>Tìm kiếm và quản lý tài liệu</p>
          </div>
          {isAdmin && (
            <button
              className={styles.uploadButton}
            >
              <Upload size={18} />
              <span>Tải lên</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | '')}
            className={styles.filterSelect}
          >
            <option value="">Tất cả trạng thái</option>
            <option value={DocumentStatus.PUBLISHED}>Đã xuất bản</option>
            <option value={DocumentStatus.DRAFT}>Nháp</option>
            <option value={DocumentStatus.ARCHIVED}>Đã lưu trữ</option>
            <option value={DocumentStatus.EXPIRED}>Hết hạn</option>
          </select>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={18} />
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Document Grid/List */}
        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={32} className={styles.spinner} />
            <span>Đang tải...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={48} />
            <h3>Không tìm thấy tài liệu</h3>
            <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? styles.grid : styles.list}>
            {documents.map((doc) => (
              <div key={doc.id} className={styles.documentCard}>
                <div className={styles.documentIcon}>
                  {getFileIcon()}
                </div>
                <div className={styles.documentInfo}>
                  <h3 className={styles.documentTitle}>{doc.title}</h3>
                  {doc.description && (
                    <p className={styles.documentDesc}>{doc.description}</p>
                  )}
                  <div className={styles.documentMeta}>
                    <span className={`${styles.status} ${statusColors[doc.status].bg} ${statusColors[doc.status].text}`}>
                      {statusLabels[doc.status]}
                    </span>
                    <span className={styles.metaItem}>
                      <FileText size={14} />
                      {formatFileSize(doc.fileSize)}
                    </span>
                    {doc.uploadedAt && (
                      <span className={styles.metaItem}>
                        <Calendar size={14} />
                        {formatDate(doc.uploadedAt)}
                      </span>
                    )}
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div className={styles.tags}>
                      {doc.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className={styles.tag}>
                          <Tag size={12} />
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className={styles.tagMore}>+{doc.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.documentActions}>
                  <button className={styles.actionButton} title="Tải xuống">
                    <Download size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className={styles.pageInfo}>
              Trang {page} / {totalPages}
            </span>
            <button
              className={styles.pageButton}
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
