import React from 'react';
import type { Subscription } from '../types.js';

type Status = Subscription['status'];

const BADGE_CONFIG: Record<Status, { label: string; modifier: string; bg: string; color: string }> = {
  active: {
    label: 'Active',
    modifier: 'subpay-badge--active',
    bg: '#dcfce7',
    color: 'var(--subpay-success, #15803d)',
  },
  paused: {
    label: 'Paused',
    modifier: 'subpay-badge--paused',
    bg: '#fef9c3',
    color: '#a16207',
  },
  past_due: {
    label: 'Past due',
    modifier: 'subpay-badge--past-due',
    bg: '#fee2e2',
    color: 'var(--subpay-danger, #b91c1c)',
  },
  cancelled: {
    label: 'Cancelled',
    modifier: 'subpay-badge--cancelled',
    bg: '#f3f4f6',
    color: 'var(--subpay-text-secondary, #4a4a4a)',
  },
};

interface SubscriptionStatusBadgeProps {
  status: Status;
}

export function SubscriptionStatusBadge({ status }: SubscriptionStatusBadgeProps) {
  const { label, modifier, bg, color } = BADGE_CONFIG[status];
  return (
    <span
      className={`subpay-badge ${modifier}`}
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        lineHeight: '20px',
      }}
    >
      {label}
    </span>
  );
}
