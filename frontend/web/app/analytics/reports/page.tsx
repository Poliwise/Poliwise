'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Download,
  Trash2,
  Loader2,
  FileBarChart,
} from 'lucide-react';
import {
  Button,
  Select,
  Input,
  Table,
  Column,
  Modal,
  Badge,
  ConfirmDialog,
  EmptyState,
  PageHeader,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsManager } from '@/store';
import styles from './reports.module.css';

type ReportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type ReportType = 'USAGE_SUMMARY' | 'QUESTION_ANALYTICS' | 'FEEDBACK_ANALYSIS' | 'USER_ENGAGEMENT' | 'DOCUMENT_POPULARITY' | 'UNANSWERED_QUESTIONS' | 'DEPARTMENT_BREAKDOWN';
type ReportFormat = 'CSV' | 'JSON';

interface Report {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  createdAt: string;
  completedAt?: string;
  fileUrl?: string;
  errorMessage?: string;
}

const REPORT_TYPES: Record<ReportType, string> = {
  USAGE_SUMMARY: 'Tổng quan sử dụng',
  QUESTION_ANALYTICS: 'Phân tích câu hỏi',
  FEEDBACK_ANALYSIS: 'Phân tích phản hồi',
  USER_ENGAGEMENT: 'Engagement người dùng',
  DOCUMENT_POPULARITY: 'Tài liệu phổ biến',
  UNANSWERED_QUESTIONS: 'Câu hỏi chưa trả lời',
  DEPARTMENT_BREAKDOWN: 'Phân tích theo phòng ban',
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; variant: 'warning' | 'neutral' | 'success' | 'destructive' }> = {
  PENDING: { label: 'Đang chờ', variant: 'warning' },
  PROCESSING: { label: 'Đang xử lý', variant: 'warning' },
  COMPLETED: { label: 'Hoàn thành', variant: 'success' },
  FAILED: { label: 'Thất bại', variant: 'destructive' },
};

export default function ReportsPage() {
  const router = useRouter();
  const isManager = useIsManager();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>('USAGE_SUMMARY');
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('CSV');
  const [reportName, setReportName] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isManager) {
      router.push('/');
      return;
    }
  }, [isManager, router]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.reports.list();
      setReports((response.data as any[]).map(r => ({
        ...r,
        name: r.title, // Map title from API to name used in UI
      })) as Report[]);
    } catch {
      setError('Không thể tải danh sách báo cáo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await api.reports.create({
        type: selectedType,
        format: selectedFormat,
        // Backend API doesn't seem to take 'name' in create, but we'll send it if needed
      });
      setModalOpen(false);
      setReportName('');
      loadReports();
    } catch {
      setError('Không thể tạo báo cáo.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const blob = await api.reports.download(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name}.${report.format.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Không thể tải báo cáo.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      // Reports API doesn't have delete, just remove from UI list
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const typeOptions = Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }));
  const formatOptions = [
    { value: 'CSV', label: 'CSV' },
    { value: 'JSON', label: 'JSON' },
  ];

  const columns: Column<Report>[] = [
    {
      key: 'name',
      header: 'Tên báo cáo',
      render: (r) => (
        <div className={styles.reportName}>
          <FileBarChart size={16} />
          <span>{r.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      render: (r) => <span className={styles.typeText}>{REPORT_TYPES[r.type]}</span>,
    },
    {
      key: 'format',
      header: 'Định dạng',
      render: (r) => <Badge variant="neutral">{r.format}</Badge>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (r) => {
        const s = STATUS_CONFIG[r.status];
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (r) => new Date(r.createdAt).toLocaleString('vi-VN'),
    },
    {
      key: 'actions',
      header: '',
      width: '8rem',
      align: 'right',
      render: (r) => (
        <div className={styles.rowActions}>
          {r.status === 'COMPLETED' && (
            <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => handleDownload(r)}>
              Tải
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className={styles.container}>
        <PageHeader
          title="Xuất báo cáo"
          description="Tạo và tải các báo cáo phân tích theo yêu cầu."
          actions={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              Tạo báo cáo
            </Button>
          }
        />

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={24} className={styles.spinner} />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileBarChart size={32} />}
            title="Chưa có báo cáo nào"
            description="Tạo báo cáo đầu tiên để xuất dữ liệu phân tích."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>Tạo báo cáo</Button>}
          />
        ) : (
          <Table columns={columns} data={reports} keyExtractor={(r) => r.id} />
        )}

        {/* Create Modal */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Tạo báo cáo mới"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Hủy</Button>
              <Button variant="primary" loading={creating} onClick={handleCreate}>
                Tạo báo cáo
              </Button>
            </>
          }
        >
          <div className={styles.form}>
            <Input
              label="Tên báo cáo"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Để trống để dùng tên mặc định..."
            />
            <Select
              label="Loại báo cáo"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ReportType)}
              options={typeOptions}
            />
            <Select
              label="Định dạng"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ReportFormat)}
              options={formatOptions}
            />
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
          title="Xóa báo cáo?"
          message={`Xóa báo cáo "${deleteTarget?.name}"?`}
          confirmLabel="Xóa"
          cancelLabel="Hủy"
          variant="danger"
        />
      </div>
    </MainLayout>
  );
}
