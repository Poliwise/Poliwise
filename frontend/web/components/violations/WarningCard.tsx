'use client';

import React from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Clock, CheckCircle, Bell } from 'lucide-react';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui';
import { Warning } from '@/types/violation';
import styles from './WarningCard.module.css';

export interface WarningCardProps {
  warning: Warning;
  onAcknowledge?: (warning: Warning) => void;
  isAcknowledging?: boolean;
}

export function WarningCard({
  warning,
  onAcknowledge,
  isAcknowledging = false,
}: WarningCardProps) {
  const isExpired = warning.expiresAt && new Date(warning.expiresAt) < new Date();
  const isRead = !!warning.readAt;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = () => {
    if (!warning.expiresAt) return null;
    const now = new Date();
    const expires = new Date(warning.expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <Card
      className={clsx(
        styles.card,
        isRead && styles.read,
        isExpired && styles.expired
      )}
      padding="md"
    >
      <div className={styles.header}>
        <div className={styles.iconSection}>
          {isRead ? (
            <CheckCircle className={styles.iconRead} size={20} />
          ) : (
            <Bell className={styles.iconUnread} size={20} />
          )}
        </div>
        <div className={styles.statusSection}>
          {isRead ? (
            <span className={styles.readBadge}>Đã đọc</span>
          ) : (
            <span className={styles.unreadBadge}>Chưa đọc</span>
          )}
          {isExpired && !isRead && (
            <span className={styles.expiredBadge}>Đã hết hạn</span>
          )}
        </div>
      </div>

      <div className={styles.message}>
        {warning.message}
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <Clock size={14} />
          <span>Ngày tạo: {formatDate(warning.createdAt)}</span>
        </div>
        {warning.expiresAt && !isExpired && (
          <div className={styles.metaItem}>
            <AlertTriangle size={14} />
            <span>
              Hết hạn: {formatDate(warning.expiresAt)}
              {daysRemaining !== null && daysRemaining > 0 && (
                <span className={styles.daysRemaining}> (còn {daysRemaining} ngày)</span>
              )}
            </span>
          </div>
        )}
        {isRead && warning.readAt && (
          <div className={styles.metaItem}>
            <CheckCircle size={14} />
            <span>Đã xác nhận: {formatDate(warning.readAt)}</span>
          </div>
        )}
      </div>

      {!isRead && onAcknowledge && (
        <div className={styles.actions}>
          <Button
            onClick={() => onAcknowledge(warning)}
            disabled={isAcknowledging}
            variant="primary"
            size="sm"
          >
            {isAcknowledging ? 'Đang xử lý...' : 'Xác nhận đã đọc'}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default WarningCard;
