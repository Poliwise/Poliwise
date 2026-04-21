'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  ThumbsUp,
  FileText,
  Users,
  Download,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Button,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Spinner,
  EmptyState,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsManager } from '@/store';
import type { DashboardStats, AnalyticsOverview } from '@/types';
import styles from './analytics.module.css';

type Period = 'today' | 'week' | 'month';

const PIE_COLORS = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const router = useRouter();
  const isManager = useIsManager();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('today');

  const [trends, setTrends] = useState<{
    date: string; questions: number; likes: number; dislikes: number;
  }[]>([]);
  const [topQuestions, setTopQuestions] = useState<{
    question: string; askCount: number; lastAskedAt: string;
  }[]>([]);
  const [topDocuments, setTopDocuments] = useState<{
    documentId: string; title: string; totalCitations: number; citationsLast7Days: number;
  }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, overviewData, trendsData, questionsData, docsData] = await Promise.all([
        api.analytics.getDashboard(),
        api.analytics.getOverview(),
        api.analytics.getTrends(period === 'today' ? 1 : period === 'week' ? 7 : 30),
        api.analytics.getTopQuestions(5),
        api.analytics.getTopDocuments(5),
      ]);
      setStats(statsData);
      setOverview(overviewData);
      setTrends(trendsData);
      setTopQuestions(questionsData);
      setTopDocuments(docsData);
    } catch {
      setError('Không thể tải dữ liệu phân tích.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!isManager) {
      router.push('/');
      return;
    }
    loadData();
  }, [isManager, loadData, router]);

  const getStatValue = (key: keyof DashboardStats) => {
    if (!stats) return 0;
    if (key === 'questionsToday') {
      return period === 'today' ? stats.questionsToday
        : period === 'week' ? stats.questionsThisWeek
        : stats.questionsThisMonth;
    }
    return stats[key] as number;
  };

  const { likes: likeCount = 0, dislikes: dislikeCount = 0 } = overview?.satisfaction || {};
  const totalFeedback = likeCount + dislikeCount;
  const satisfactionRate = totalFeedback > 0 ? Math.round((likeCount / totalFeedback) * 100) : 0;

  const pieData = [
    { name: 'Hữu ích', value: likeCount },
    { name: 'Không hữu ích', value: dislikeCount },
  ].filter((d) => d.value > 0);

  const periodOptions = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'week', label: 'Tuần này' },
    { value: 'month', label: 'Tháng này' },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className={styles.loading}>
          <Spinner size="lg" label="Đang tải dữ liệu phân tích..." />
        </div>
      </MainLayout>
    );
  }

  if (error || !stats) {
    return (
      <MainLayout>
        <div className={styles.container}>
          <EmptyState
            icon={<TrendingUp size={32} />}
            title="Không thể tải dữ liệu"
            description={error || 'Đã xảy ra lỗi khi tải dữ liệu phân tích.'}
            action={<Button variant="secondary" onClick={loadData}>Thử lại</Button>}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Báo cáo phân tích</h1>
            <p className={styles.subtitle}>Theo dõi hoạt động và hiệu suất hệ thống</p>
          </div>
          <div className={styles.actions}>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              options={periodOptions}
              selectSize="sm"
              className={styles.periodSelect}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={16} />}
              onClick={() => router.push('/analytics/reports')}
            >
              Xuất báo cáo
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <Card padding="md">
            <div className={styles.statCardInner}>
              <div className={styles.statIconWrap} style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}>
                <MessageSquare size={22} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Câu hỏi</span>
                <span className={styles.statValue}>{getStatValue('questionsToday').toLocaleString()}</span>
                {stats.questionsThisWeek > 0 && (
                  <span className={styles.statMeta}>
                    {stats.questionsThisMonth.toLocaleString()} tháng này
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className={styles.statCardInner}>
              <div className={styles.statIconWrap} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                <ThumbsUp size={22} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Tỷ lệ hài lòng</span>
                <span className={styles.statValue}>{satisfactionRate}%</span>
                <span className={styles.statMeta}>
                  {likeCount} hữu ích / {dislikeCount} không
                </span>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className={styles.statCardInner}>
              <div className={styles.statIconWrap} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <FileText size={22} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Tài liệu hoạt động</span>
                <span className={styles.statValue}>{stats.activeDocuments}</span>
                <span className={styles.statMeta}>{stats.totalDocuments} tổng cộng</span>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className={styles.statCardInner}>
              <div className={styles.statIconWrap} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Users size={22} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Người dùng hoạt động</span>
                <span className={styles.statValue}>{stats.activeUsers}</span>
                <span className={styles.statMeta}>{stats.totalUsers} tổng cộng</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className={styles.chartsGrid}>
          {/* Trends Chart */}
          <Card padding="md" className={styles.chartCard}>
            <CardHeader>
              <CardTitle as="h3">Xu hướng câu hỏi</CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.8125rem',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                    <Line type="monotone" dataKey="questions" stroke="#4f46e5" strokeWidth={2} name="Câu hỏi" dot={false} />
                    <Line type="monotone" dataKey="likes" stroke="#22c55e" strokeWidth={2} name="Hữu ích" dot={false} />
                    <Line type="monotone" dataKey="dislikes" stroke="#ef4444" strokeWidth={2} name="Không hữu ích" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.chartEmpty}>
                  <TrendingUp size={32} />
                  <span>Chưa có dữ liệu xu hướng</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback Pie Chart */}
          <Card padding="md" className={styles.chartCard}>
            <CardHeader>
              <CardTitle as="h3">Tỷ lệ phản hồi</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.8125rem',
                      }}
                      formatter={(value: any) => [`${value} phản hồi`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.chartEmpty}>
                  <ThumbsUp size={32} />
                  <span>Chưa có phản hồi</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Questions + Documents */}
        <div className={styles.listsGrid}>
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Câu hỏi phổ biến</CardTitle>
            </CardHeader>
            <CardContent>
              {topQuestions.length > 0 ? (
                <div className={styles.topList}>
                  {topQuestions.map((q, i) => (
                    <div key={i} className={styles.topItem}>
                      <span className={styles.topRank}>{i + 1}</span>
                      <div className={styles.topInfo}>
                        <span className={styles.topQuestion}>{q.question}</span>
                        <span className={styles.topMeta}>
                          {q.askCount} lượt · {new Date(q.lastAskedAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>Chưa có dữ liệu câu hỏi phổ biến.</p>
              )}
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">Tài liệu được trích dẫn nhiều</CardTitle>
            </CardHeader>
            <CardContent>
              {topDocuments.length > 0 ? (
                <div className={styles.topList}>
                  {topDocuments.map((d, i) => (
                    <div key={i} className={styles.topItem}>
                      <span className={styles.topRank}>{i + 1}</span>
                      <div className={styles.topInfo}>
                        <span className={styles.topQuestion}>{d.title}</span>
                        <span className={styles.topMeta}>
                          {d.totalCitations} lượt trích dẫn
                          {d.citationsLast7Days > 0 && ` · +${d.citationsLast7Days} tuần này`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>Chưa có dữ liệu tài liệu phổ biến.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
