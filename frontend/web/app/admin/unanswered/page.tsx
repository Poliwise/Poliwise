'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  HelpCircle,
  Search,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Badge,
  Table,
  Column,
  Modal,
  ConfirmDialog,
  PageHeader,
  EmptyState,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsManager } from '@/store';
import styles from './unanswered.module.css';

type UnansweredStatus = 'PENDING' | 'REVIEWING' | 'ANSWERED' | 'REJECTED';

interface UnansweredQuestion {
  id: string;
  question: string;
  askCount: number;
  departmentName?: string;
  userName?: string;
  firstAskedAt: string;
  lastAskedAt: string;
  status: UnansweredStatus;
  suggestedAnswer?: string;
}

const STATUS_CONFIG: Record<UnansweredStatus, { label: string; variant: 'warning' | 'neutral' | 'success' | 'destructive' }> = {
  PENDING: { label: 'Chưa xử lý', variant: 'warning' },
  REVIEWING: { label: 'Đang xem xét', variant: 'neutral' },
  ANSWERED: { label: 'Đã trả lời', variant: 'success' },
  REJECTED: { label: 'Từ chối', variant: 'destructive' },
};

export default function UnansweredQuestionsPage() {
  const router = useRouter();
  const isManager = useIsManager();

  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Resolve modal
  const [resolveTarget, setResolveTarget] = useState<UnansweredQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [resolving, setResolving] = useState(false);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<UnansweredQuestion | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.analytics.getUnansweredQuestions();
      setQuestions(data as unknown as UnansweredQuestion[]);
    } catch {
      setError('Không thể tải danh sách câu hỏi chưa trả lời.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isManager) {
      router.push('/');
      return;
    }
    loadQuestions();
  }, [isManager, router, loadQuestions]);

  const handleResolve = async () => {
    if (!resolveTarget || !answerText.trim()) return;
    setResolving(true);
    setError(null);
    try {
      await api.analytics.resolveUnanswered(resolveTarget.id, { answer: answerText.trim() });
      setResolveTarget(null);
      setAnswerText('');
      loadQuestions();
    } catch {
      setError('Không thể đánh dấu đã trả lời.');
    } finally {
      setResolving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    setError(null);
    try {
      await api.analytics.rejectUnanswered(rejectTarget.id);
      setRejectTarget(null);
      loadQuestions();
    } catch {
      setError('Không thể từ chối câu hỏi.');
    } finally {
      setRejecting(false);
    }
  };

  const filtered = questions.filter((q) => {
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && q.status !== statusFilter) return false;
    return true;
  });

  const statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PENDING', label: 'Chưa xử lý' },
    { value: 'REVIEWING', label: 'Đang xem xét' },
    { value: 'ANSWERED', label: 'Đã trả lời' },
    { value: 'REJECTED', label: 'Từ chối' },
  ];

  const columns: Column<UnansweredQuestion>[] = [
    {
      key: 'question',
      header: 'Câu hỏi',
      render: (q) => (
        <div className={styles.questionCell}>
          <HelpCircle size={14} />
          <span>{q.question}</span>
        </div>
      ),
    },
    {
      key: 'askCount',
      header: 'Số lần',
      align: 'center',
      render: (q) => <Badge variant="neutral">{q.askCount}</Badge>,
    },
    {
      key: 'departmentName',
      header: 'Phòng ban',
      render: (q) => <span className={styles.deptText}>{q.departmentName || '-'}</span>,
    },
    {
      key: 'lastAskedAt',
      header: 'Hỏi lần cuối',
      render: (q) => new Date(q.lastAskedAt).toLocaleDateString('vi-VN'),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (q) => {
        const s = STATUS_CONFIG[q.status];
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      width: '10rem',
      align: 'right',
      render: (q) =>
        q.status !== 'ANSWERED' && q.status !== 'REJECTED' ? (
          <div className={styles.rowActions}>
            <Button variant="ghost" size="sm" onClick={() => setResolveTarget(q)}>
              Trả lời
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejectTarget(q)}>
              Từ chối
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <MainLayout>
      <div className={styles.container}>
        <PageHeader
          title="Câu hỏi chưa trả lời"
          description="Theo dõi và xử lý các câu hỏi chưa được trả lời."
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.filters}>
          <Input
            placeholder="Tìm kiếm câu hỏi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            inputSize="sm"
            className={styles.searchInput}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            selectSize="sm"
            className={styles.statusSelect}
          />
        </div>

        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={24} className={styles.spinner} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={32} />}
            title="Không có câu hỏi chưa trả lời"
            description="Tất cả câu hỏi đã được xử lý."
          />
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={(q) => q.id} />
        )}

        {/* Resolve Modal */}
        <Modal
          open={!!resolveTarget}
          onClose={() => { setResolveTarget(null); setAnswerText(''); }}
          title="Trả lời câu hỏi"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setResolveTarget(null); setAnswerText(''); }}>Hủy</Button>
              <Button variant="primary" loading={resolving} onClick={handleResolve} disabled={!answerText.trim()}>
                Gửi câu trả lời
              </Button>
            </>
          }
        >
          <div className={styles.form}>
            <div className={styles.questionPreview}>
              <HelpCircle size={16} />
              <p>{resolveTarget?.question}</p>
            </div>
            {resolveTarget?.suggestedAnswer && (
              <div className={styles.suggested}>
                <span>Gợi ý:</span>
                <p>{resolveTarget.suggestedAnswer}</p>
              </div>
            )}
            <textarea
              className={styles.answerInput}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Nhập câu trả lời..."
              rows={5}
            />
          </div>
        </Modal>

        {/* Reject Confirm */}
        <ConfirmDialog
          open={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleReject}
          loading={rejecting}
          title="Từ chối câu hỏi?"
          message={`Từ chối câu hỏi "${rejectTarget?.question}"? Câu hỏi sẽ được đánh dấu là đã xử lý.`}
          confirmLabel="Từ chối"
          cancelLabel="Hủy"
          variant="warning"
        />
      </div>
    </MainLayout>
  );
}
