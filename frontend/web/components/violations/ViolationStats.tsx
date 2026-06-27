'use client';

import React from 'react';
import { AlertTriangle, Bell, Clock, MessageSquare } from 'lucide-react';
import { StatCard } from '@/components/ui';
import { ViolationStats as ViolationStatsType } from '@/types/violation';

export interface ViolationStatsProps {
  stats?: ViolationStatsType;
  isLoading?: boolean;
}

export function ViolationStats({ stats, isLoading = false }: ViolationStatsProps) {
  if (!stats && !isLoading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Vi phạm chờ xử lý"
        value={stats?.pendingViolations ?? '-'}
        icon={<AlertTriangle size={20} />}
        tone="warning"
        change={stats?.pendingViolations ?? 0}
        changeLabel="cần xử lý"
      />
      <StatCard
        label="Tổng vi phạm"
        value={stats?.totalViolations ?? 0}
        icon={<Clock size={20} />}
        tone="info"
      />
      <StatCard
        label="Khiếu nại chờ duyệt"
        value={stats?.pendingAppeals ?? 0}
        icon={<MessageSquare size={20} />}
        tone="purple"
        change={stats?.pendingAppeals ?? 0}
        changeLabel="cần xem xét"
      />
      <StatCard
        label="Cảnh báo"
        value={stats?.totalWarnings ?? 0}
        icon={<Bell size={20} />}
        tone="danger"
      />
    </div>
  );
}

export default ViolationStats;
