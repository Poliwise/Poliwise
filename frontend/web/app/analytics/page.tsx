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
  AlertTriangle,
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
import { useLanguage } from '@/providers';
import { ApiHealthCard, EndpointDetailsModal } from '@/components/api-health';
import type { DashboardStats, AnalyticsOverview, ApiMetricsResponse } from '@/types';
import styles from './analytics.module.css';

type Period = 'today' | 'week' | 'month';

const PIE_COLORS = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const router = useRouter();
  const isManager = useIsManager();
  const { t } = useLanguage();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('today');

  const [apiMetrics, setApiMetrics] = useState<ApiMetricsResponse | null>(null);
  const [apiMetricsLoading, setApiMetricsLoading] = useState(true);
  const [endpointModalOpen, setEndpointModalOpen] = useState(false);

  const [trends, setTrends] = useState<{
    date: string; questions: number; likes: number; dislikes: number;
  }[]>([]);
  const [topQuestions, setTopQuestions] = useState<{
    question: string; askCount: number; lastAskedAt: string;
  }[]>([]);
  const [topDocuments, setTopDocuments] = useState<{
    documentId: string; title: string; totalCitations: number; citationsLast7Days: number;
  }[]>([]);

  const loadData = useCallback(async (currentPeriod: Period) => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, overviewData, trendsData, questionsData, docsData] = await Promise.all([
        api.analytics.getDashboard(),
        api.analytics.getOverview(),
        api.analytics.getTrends(currentPeriod === 'today' ? 1 : currentPeriod === 'week' ? 7 : 30),
        api.analytics.getTopQuestions(5),
        api.analytics.getTopDocuments(5),
      ]);
      setStats(statsData);
      setOverview(overviewData);
      setTrends(trendsData);
      setTopQuestions(questionsData);
      setTopDocuments(docsData);
    } catch {
      setError(t('analytics.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadApiMetrics = useCallback(async (currentPeriod: Period) => {
    try {
      const data = await api.metrics.getApiHealth(
        currentPeriod === 'today' ? 1 : currentPeriod === 'week' ? 7 : 30
      );
      setApiMetrics(data);
    } catch {
      setApiMetrics(null);
    } finally {
      setApiMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isManager) {
      router.push('/');
      return;
    }
    loadData(period);
    loadApiMetrics(period);
  }, [isManager, period, loadData, loadApiMetrics, router]);

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
    { name: t('analytics.chart.useful'), value: likeCount },
    { name: t('analytics.chart.notUseful'), value: dislikeCount },
  ].filter((d) => d.value > 0);

  const periodOptions = [
    { value: 'today', label: t('analytics.period.today') },
    { value: 'week', label: t('analytics.period.week') },
    { value: 'month', label: t('analytics.period.month') },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className={styles.loading}>
          <Spinner size="lg" label={t('analytics.loading')} />
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
            title={t('analytics.empty')}
            description={error || t('analytics.loadError')}
            action={<Button variant="secondary" onClick={() => loadData(period)}>{t('analytics.retry')}</Button>}
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
            <h1 className={styles.title}>{t('analytics.title')}</h1>
            <p className={styles.subtitle}>{t('analytics.subtitle')}</p>
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
              {t('analytics.export')}
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
                <span className={styles.statLabel}>{t('analytics.stat.questions')}</span>
                <span className={styles.statValue}>{getStatValue('questionsToday').toLocaleString()}</span>
                {stats.questionsThisWeek > 0 && (
                  <span className={styles.statMeta}>
                    {stats.questionsThisMonth.toLocaleString()} {t('analytics.stat.questionsMonth')}
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
                <span className={styles.statLabel}>{t('analytics.stat.satisfaction')}</span>
                <span className={styles.statValue}>{satisfactionRate}%</span>
                <span className={styles.statMeta}>
                  {likeCount} {t('analytics.chart.useful')} / {dislikeCount} {t('analytics.chart.notUseful')}
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
                <span className={styles.statLabel}>{t('analytics.stat.activeDocuments')}</span>
                <span className={styles.statValue}>{stats.activeDocuments}</span>
                <span className={styles.statMeta}>{stats.totalDocuments} {t('analytics.stat.totalDocuments')}</span>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className={styles.statCardInner}>
              <div className={styles.statIconWrap} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Users size={22} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>{t('analytics.stat.activeUsers')}</span>
                <span className={styles.statValue}>{stats.activeUsers}</span>
                <span className={styles.statMeta}>{stats.totalUsers} {t('analytics.stat.totalUsers')}</span>
              </div>
            </div>
          </Card>

          <ApiHealthCard
            metrics={apiMetrics}
            loading={apiMetricsLoading}
            onClick={() => setEndpointModalOpen(true)}
          />
        </div>

        {/* Charts Row */}
        <div className={styles.chartsGrid}>
          {/* Trends Chart */}
          <Card padding="md" className={styles.chartCard}>
            <CardHeader>
              <CardTitle as="h3">{t('analytics.chart.trends')}</CardTitle>
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
                    <Line type="monotone" dataKey="questions" stroke="#4f46e5" strokeWidth={2} name={t('analytics.chart.question')} dot={false} />
                    <Line type="monotone" dataKey="likes" stroke="#22c55e" strokeWidth={2} name={t('analytics.chart.useful')} dot={false} />
                    <Line type="monotone" dataKey="dislikes" stroke="#ef4444" strokeWidth={2} name={t('analytics.chart.notUseful')} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.chartEmpty}>
                  <TrendingUp size={32} />
                  <span>{t('analytics.chart.empty')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback Pie Chart */}
          <Card padding="md" className={styles.chartCard}>
            <CardHeader>
              <CardTitle as="h3">{t('analytics.chart.feedback')}</CardTitle>
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
                      formatter={(value: any) => [`${value} responses`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.chartEmpty}>
                  <ThumbsUp size={32} />
                  <span>{t('analytics.chart.feedbackEmpty')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Trend Chart */}
        {apiMetrics && apiMetrics.dailyErrors.length > 0 && (
          <Card padding="md" className={styles.chartCard}>
            <CardHeader>
              <CardTitle as="h3">Xu hướng lỗi API theo ngày</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={apiMetrics.dailyErrors}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '0.8125rem',
                    }}
                    formatter={(value: any) => [`${value} errors`, 'Errors']}
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Errors"
                    dot={{ fill: '#ef4444', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Questions + Documents */}
        <div className={styles.listsGrid}>
          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">{t('analytics.list.questions')}</CardTitle>
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
                          {q.askCount} · {new Date(q.lastAskedAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>{t('analytics.list.questions.empty')}</p>
              )}
            </CardContent>
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle as="h3">{t('analytics.list.documents')}</CardTitle>
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
                          {d.totalCitations} {t('analytics.list.citations')}
                          {d.citationsLast7Days > 0 && ` · +${d.citationsLast7Days} ${t('analytics.list.citationsWeek')}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>{t('analytics.list.documents.empty')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <EndpointDetailsModal
          open={endpointModalOpen}
          onClose={() => setEndpointModalOpen(false)}
          metrics={apiMetrics}
        />
      </div>
    </MainLayout>
  );
}
