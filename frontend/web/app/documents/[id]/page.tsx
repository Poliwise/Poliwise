'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  FileText,
  GitBranch,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  Breadcrumb,
  Spinner,
  EmptyState,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import { Document, DocumentStatus } from '@/types';
import styles from './document-detail.module.css';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; variant: 'success' | 'warning' | 'neutral' | 'destructive' }> = {
  [DocumentStatus.PUBLISHED]: { label: 'Đã xuất bản', variant: 'success' },
  [DocumentStatus.DRAFT]: { label: 'Nháp', variant: 'warning' },
  [DocumentStatus.ARCHIVED]: { label: 'Đã lưu trữ', variant: 'neutral' },
  [DocumentStatus.EXPIRED]: { label: 'Hết hạn', variant: 'destructive' },
};

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;
  const isAdmin = useIsAdmin();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadDoc = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.documents.getById(docId);
      setDoc(data);
    } catch {
      setError('Không thể tải thông tin tài liệu.');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const blob = await api.documents.download(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Không thể tải tài liệu.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!doc || !confirm(`Xóa tài liệu "${doc.title}"?`)) return;
    try {
      await api.documents.delete(doc.id);
      router.push('/documents');
    } catch {
      setError('Không thể xóa tài liệu.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Đang tải..." />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className={styles.container}>
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => router.back()}>
          Quay lại
        </Button>
        <EmptyState
          icon={<AlertCircle size={32} />}
          title="Không tìm thấy tài liệu"
          description={error || 'Tài liệu này có thể đã bị xóa.'}
          action={
            <Button variant="secondary" onClick={() => router.push('/documents')}>
              Quay lại kho tài liệu
            </Button>
          }
        />
      </div>
    );
  }

  const status = STATUS_CONFIG[doc.status];
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.container}>
      <Breadcrumb
        items={[
          { label: 'Tài liệu', href: '/documents' },
          { label: doc.title },
        ]}
        className={styles.breadcrumb}
      />

      <div className={styles.header}>
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => router.back()}>
          Quay lại
        </Button>
        <div className={styles.headerActions}>
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Xóa tài liệu
            </Button>
          )}
          <Button variant="primary" size="sm" icon={<Download size={16} />} loading={downloading} onClick={handleDownload}>
            Tải xuống
          </Button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.grid}>
        {/* Main info */}
        <Card padding="lg">
          <div className={styles.docHeader}>
            <div className={styles.docIcon}>
              <FileText size={32} />
            </div>
            <div className={styles.docMeta}>
              <h1 className={styles.docTitle}>{doc.title}</h1>
              <div className={styles.docBadges}>
                <Badge variant={status.variant}>{status.label}</Badge>
                {doc.version > 1 && (
                  <Badge variant="neutral" icon={<GitBranch size={12} />}>
                    Phiên bản {doc.version}
                  </Badge>
                )}
                <Badge variant="neutral">{formatFileSize(doc.fileSize)}</Badge>
              </div>
            </div>
          </div>

          {doc.description && (
            <p className={styles.description}>{doc.description}</p>
          )}

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>File</span>
              <span className={styles.infoValue}>{doc.fileName}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Loại file</span>
              <span className={styles.infoValue}>{doc.fileType}</span>
            </div>
            {doc.categoryName && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Danh mục</span>
                <span className={styles.infoValue}>{doc.categoryName}</span>
              </div>
            )}
            {doc.departmentName && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Phòng ban</span>
                <span className={styles.infoValue}>{doc.departmentName}</span>
              </div>
            )}
            {doc.uploadedByName && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Người tải lên</span>
                <span className={styles.infoValue}>{doc.uploadedByName}</span>
              </div>
            )}
            {doc.uploadedAt && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Ngày tải lên</span>
                <span className={styles.infoValue}>
                  {new Date(doc.uploadedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            )}
            {doc.updatedAt && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Cập nhật lần cuối</span>
                <span className={styles.infoValue}>
                  {new Date(doc.updatedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            )}
            {doc.effectiveDate && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Ngày hiệu lực</span>
                <span className={styles.infoValue}>
                  {new Date(doc.effectiveDate).toLocaleDateString('vi-VN')}
                </span>
              </div>
            )}
            {doc.expireDate && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Ngày hết hạn</span>
                <span className={styles.infoValue}>
                  {new Date(doc.expireDate).toLocaleDateString('vi-VN')}
                </span>
              </div>
            )}
          </div>

          {doc.tags && doc.tags.length > 0 && (
            <div className={styles.tags}>
              {doc.tags.map((tag) => (
                <Badge key={tag} variant="neutral">{tag}</Badge>
              ))}
            </div>
          )}
        </Card>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card padding="md">
            <div className={styles.sidebarItem}>
              <Download size={16} />
              <div>
                <span className={styles.sidebarLabel}>Tải tài liệu</span>
                <span className={styles.sidebarValue}>{formatFileSize(doc.fileSize)}</span>
              </div>
              <Button size="sm" icon={<Download size={14} />} loading={downloading} onClick={handleDownload}>
                Tải
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
