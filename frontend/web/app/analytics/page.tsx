'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  FileText,
  Users,
  ThumbsUp,
  ThumbsDown,
  Download,
  Loader2,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsManager } from '@/store';
import type { DashboardStats } from '@/types';
import styles from './analytics.module.css';

export default function AnalyticsPage() {
  const isManager = useIsManager();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    if (!isManager) {
      router.push('/');
      return;
    }
    loadStats();
  }, [isManager]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.analytics.getDashboard();
      setStats(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className={styles.loading}>
          <Loader2 size={32} className={styles.spinner} />
          <span>Đang tải dữ liệu...</span>
        </div>
      </MainLayout>
    );
  }

  const getStatValue = (key: keyof DashboardStats) => {
    if (!stats) return 0;
    switch (key) {
      case 'questionsToday':
        return period === 'today' ? stats.questionsToday : period === 'week' ? stats.questionsThisWeek : stats.questionsThisMonth;
      default:
        return stats[key] as number;
    }
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Báo cáo phân tích</h1>
            <p className={styles.subtitle}>Theo dõi hoạt động và hiệu suất hệ thống</p>
          </div>
          <div className={styles.actions}>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className={styles.periodSelect}
            >
              <option value="today">Hôm nay</option>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
            <button className={styles.exportButton}>
              <Download size={18} />
              <span>Xuất báo cáo</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}>
              <MessageSquare size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Câu hỏi</span>
              <span className={styles.statValue}>{getStatValue('questionsToday').toLocaleString()}</span>
              <span className={styles.statChange}>
                <ArrowUp size={14} />
                12% so với tuần trước
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <ThumbsUp size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Tỷ lệ hài lòng</span>
              <span className={styles.statValue}>{stats?.satisfactionRate || 0}%</span>
              <span className={styles.statChange}>
                <ArrowUp size={14} />
                5% cải thiện
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <FileText size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Tài liệu</span>
              <span className={styles.statValue}>{stats?.activeDocuments || 0}</span>
              <span className={styles.statChange}>
                <ArrowUp size={14} />
                {stats?.totalDocuments || 0} tổng cộng
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Users size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Người dùng hoạt động</span>
              <span className={styles.statValue}>{stats?.activeUsers || 0}</span>
              <span className={styles.statChange}>
                <ArrowUp size={14} />
                {stats?.totalUsers || 0} tổng cộng
              </span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className={styles.chartsGrid}>
          {/* Placeholder for Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3>Số câu hỏi theo thời gian</h3>
              <BarChart3 size={20} />
            </div>
            <div className={styles.chartPlaceholder}>
              <TrendingUp size={48} />
              <p>Biểu đồ xu hướng câu hỏi</p>
            </div>
          </div>

          {/* Placeholder for Pie Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3>Phân bố theo phòng ban</h3>
              <Users size={20} />
            </div>
            <div className={styles.chartPlaceholder}>
              <Users size={48} />
              <p>Biểu đồ phân bố</p>
            </div>
          </div>
        </div>

        {/* Top Lists */}
        <div className={styles.listsGrid}>
          {/* Top Questions */}
          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h3>Câu hỏi phổ biến</h3>
              <MessageSquare size={20} />
            </div>
            <div className={styles.listContent}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listRank}>{i}</span>
                  <span className={styles.listText}>
                    Cách thức làm việc từ xa được quy định như thế nào?
                  </span>
                  <span className={styles.listCount}>156 lượt</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Documents */}
          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h3>Tài liệu được trích dẫn nhiều</h3>
              <FileText size={20} />
            </div>
            <div className={styles.listContent}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.listItem}>
                  <span className={styles.listRank}>{i}</span>
                  <span className={styles.listText}>
                    Quy chế làm việc từ xa 2024
                  </span>
                  <span className={styles.listCount}>89 lượt</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feedback Summary */}
        <div className={styles.feedbackSection}>
          <div className={styles.feedbackCard}>
            <div className={styles.feedbackHeader}>
              <h3>Tổng quan phản hồi</h3>
            </div>
            <div className={styles.feedbackContent}>
              <div className={styles.feedbackStat}>
                <ThumbsUp size={32} className={styles.likeIcon} />
                <span className={styles.feedbackValue}>847</span>
                <span className={styles.feedbackLabel}>Hữu ích</span>
              </div>
              <div className={styles.feedbackDivider} />
              <div className={styles.feedbackStat}>
                <ThumbsDown size={32} className={styles.dislikeIcon} />
                <span className={styles.feedbackValue}>42</span>
                <span className={styles.feedbackLabel}>Không hữu ích</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
