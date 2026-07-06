'use client';

import React from 'react';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import { StatCard } from '@/components/ui';
import { ViolationStats as ViolationStatsType } from '@/types/violation';

export interface ViolationStatsProps {
  stats?: ViolationStatsType;
  isLoading?: boolean;
}

export function ViolationStats({ stats, isLoading = false }: ViolationStatsProps) {
  if (!stats && !isLoading) return null;

  const processedViolations = (stats?.totalViolations ?? 0) - (stats?.pendingViolations ?? 0);

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
        label="Đã xử lý"
        value={processedViolations}
        icon={<CheckCircle size={20} />}
        tone="success"
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
