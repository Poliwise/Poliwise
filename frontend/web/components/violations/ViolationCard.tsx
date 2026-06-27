'use client';

import React from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Clock, MessageSquare, Shield, User } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import {
  AppealStatus,
  AppealStatusLabels,
  Violation,
  ViolationActionLabels,
  ViolationSeverity,
  ViolationSeverityLabels,
  ViolationStatus,
  ViolationStatusLabels,
  ViolationType,
  ViolationTypeLabels,
} from '@/types/violation';
import styles from './ViolationCard.module.css';

export interface ViolationCardProps {
  violation: Violation;
  showUser?: boolean;
  showActions?: boolean;
  onAppeal?: (violation: Violation) => void;
  onReview?: (violation: Violation) => void;
  isAdmin?: boolean;
}

const severityVariant: Record<ViolationSeverity, 'info' | 'warning' | 'danger'> = {
  [ViolationSeverity.LOW]: 'info',
  [ViolationSeverity.MEDIUM]: 'warning',
  [ViolationSeverity.HIGH]: 'danger',
};

const statusVariant: Record<ViolationStatus, 'warning' | 'info' | 'success'> = {
  [ViolationStatus.PENDING]: 'warning',
  [ViolationStatus.REVIEWED]: 'info',
  [ViolationStatus.ACTIONED]: 'success',
};

const appealVariant: Record<AppealStatus, 'warning' | 'success' | 'danger'> = {
  [AppealStatus.PENDING]: 'warning',
  [AppealStatus.APPROVED]: 'success',
  [AppealStatus.REJECTED]: 'danger',
};

const typeVariant: Record<ViolationType, 'danger' | 'warning' | 'info' | 'purple'> = {
  [ViolationType.TOXIC_QUERY]: 'danger',
  [ViolationType.ABUSE]: 'warning',
  [ViolationType.SPAM]: 'info',
  [ViolationType.POLICY_BREAK]: 'purple',
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const day = date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} lúc ${time}`;
}

export function ViolationCard({
  violation,
  showUser = false,
  showActions = false,
  onAppeal,
  onReview,
  isAdmin = false,
}: ViolationCardProps) {
  const canAppeal =
    violation.appealStatus === AppealStatus.PENDING &&
    !violation.appealText &&
    violation.status !== ViolationStatus.ACTIONED;

  return (
    <Card className={clsx(styles.card, styles[`severity${violation.severity}`])} padding="md">
      <div className={styles.header}>
        <div className={styles.badges}>
          <Badge variant={severityVariant[violation.severity]}>
            {ViolationSeverityLabels[violation.severity]}
          </Badge>
          <Badge variant={typeVariant[violation.violationType]}>
            {ViolationTypeLabels[violation.violationType]}
          </Badge>
          {violation.source === 'SYSTEM' && <Badge variant="info">Tự động</Badge>}
        </div>

        <div className={styles.statusSection}>
          <Badge variant={statusVariant[violation.status]}>
            {ViolationStatusLabels[violation.status]}
          </Badge>
          {violation.appealStatus && violation.appealStatus !== AppealStatus.PENDING && (
            <Badge variant={appealVariant[violation.appealStatus]}>
              {AppealStatusLabels[violation.appealStatus]}
            </Badge>
          )}
        </div>
      </div>

      <div className={styles.evidence}>
        <div className={styles.evidenceLabel}>
          <AlertTriangle size={14} />
          <span>Nội dung vi phạm:</span>
        </div>
        <div className={styles.evidenceContent}>
          <code>{violation.evidence}</code>
        </div>
      </div>

      {showUser && (
        <div className={styles.userInfo}>
          <User size={14} />
          <span>{violation.userUsername || violation.userFullName || 'Người dùng'}</span>
          <code>{violation.userId}</code>
        </div>
      )}

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <Clock size={14} />
          <span>{formatDate(violation.createdAt)}</span>
        </div>
        {violation.actionTaken && (
          <div className={styles.metaItem}>
            <Shield size={14} />
            <span>Hành động: {ViolationActionLabels[violation.actionTaken]}</span>
          </div>
        )}
      </div>

      {violation.appealText && (
        <div className={styles.appealSection}>
          <div className={styles.appealLabel}>
            <MessageSquare size={14} />
            <span>Đơn khiếu nại:</span>
          </div>
          <p className={styles.appealText}>{violation.appealText}</p>
          {violation.appealReviewedAt && (
            <div className={styles.appealMeta}>
              Đã xem xét: {formatDate(violation.appealReviewedAt)}
            </div>
          )}
        </div>
      )}

      {(showActions || onAppeal || onReview) && (
        <div className={styles.actions}>
          {canAppeal && onAppeal && !isAdmin && (
            <Button type="button" onClick={() => onAppeal(violation)} size="sm">
              Khiếu nại
            </Button>
          )}
          {showActions && isAdmin && violation.status === ViolationStatus.PENDING && onReview && (
            <Button
              type="button"
              onClick={() => onReview(violation)}
              variant="primaryOutline"
              size="sm"
            >
              Xem xét
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default ViolationCard;
