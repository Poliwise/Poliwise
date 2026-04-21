'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import styles from './stat-card.module.css';

type TrendDirection = 'up' | 'down' | 'neutral';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: TrendDirection;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  trend,
  className,
}: StatCardProps) {
  const resolvedTrend = trend || (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : 'neutral');

  return (
    <div className={clsx(styles.card, className)}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <div className={styles.icon}>{icon}</div>}
      </div>
      <div className={styles.body}>
        <span className={styles.value}>{value}</span>
        {change !== undefined && (
          <div className={clsx(styles.change, styles[resolvedTrend])}>
            {resolvedTrend === 'up' && <TrendingUp size={14} />}
            {resolvedTrend === 'down' && <TrendingDown size={14} />}
            {resolvedTrend === 'neutral' && <Minus size={14} />}
            <span>
              {change > 0 ? '+' : ''}
              {change}
              {changeLabel && ` ${changeLabel}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
