import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSubPay } from '../provider.js';
import { SubPaySDKError, Subscription } from '../types.js';
import { formatDate, formatInterval } from '../utils/format.js';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge.js';

export interface SubscriptionManagerProps {
  subscriptionId?: string;
  walletAddress?: string;
  onCancel?: (sub: Subscription) => void;
  onPause?: (sub: Subscription) => void;
  onResume?: (sub: Subscription) => void;
  className?: string;
}

type ConfirmAction = 'pause' | 'cancel' | 'resume';

// ─── Focus trap hook ──────────────────────────────────────────────────────────

function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [active, ref]);
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  action: ConfirmAction;
  subscription: Subscription;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function SubscriptionActionConfirmModal({
  action,
  subscription,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const nextCharge = subscription.nextChargeAt instanceof Date
    ? subscription.nextChargeAt
    : new Date(subscription.nextChargeAt);

  const content: Record<ConfirmAction, { title: string; body: React.ReactNode; confirmLabel: string; destructive: boolean }> = {
    pause: {
      title: 'Pause your subscription?',
      body: (
        <>
          <p>Your <strong>{subscription.plan.name}</strong> subscription will be paused.</p>
          <p>You won&apos;t be charged while paused.</p>
          <p>Resume anytime to reactivate.</p>
        </>
      ),
      confirmLabel: 'Pause subscription',
      destructive: false,
    },
    cancel: {
      title: 'Cancel your subscription?',
      body: (
        <>
          <p>Your <strong>{subscription.plan.name}</strong> subscription will be cancelled.</p>
          <p>You&apos;ll lose access at the end of the current period.</p>
          <p>This cannot be undone.</p>
        </>
      ),
      confirmLabel: 'Yes, cancel',
      destructive: true,
    },
    resume: {
      title: 'Resume your subscription?',
      body: (
        <>
          <p>Your <strong>{subscription.plan.name}</strong> subscription will resume.</p>
          <p>
            Your next charge of ${subscription.plan.amountUsdc.toFixed(2)} USDC is on{' '}
            {formatDate(nextCharge)}.
          </p>
        </>
      ),
      confirmLabel: 'Resume subscription',
      destructive: false,
    },
  };

  const { title, body, confirmLabel, destructive } = content[action];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-busy={isLoading}
        style={{
          background: 'var(--subpay-bg-primary, #fff)',
          color: 'var(--subpay-text-primary, #1a1a1a)',
          borderRadius: 12, padding: '28px 28px 24px',
          maxWidth: 400, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 id={headingId} style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>
          {title}
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--subpay-text-secondary, #4a4a4a)', marginBottom: 24 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              minHeight: 44, minWidth: 44, padding: '10px 20px', fontSize: 14,
              fontWeight: 500, borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--subpay-border, #d1d5db)',
              background: 'transparent', color: 'var(--subpay-text-primary, #1a1a1a)',
            }}
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={destructive ? 'subpay-action-destructive' : undefined}
            style={{
              minHeight: 44, padding: '10px 20px', fontSize: 14, fontWeight: 600,
              borderRadius: 8, cursor: isLoading ? 'wait' : 'pointer', border: 'none',
              background: destructive
                ? 'var(--subpay-danger, #b91c1c)'
                : 'var(--subpay-accent, #2563EB)',
              color: '#fff', opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SubscriptionManager ──────────────────────────────────────────────────────

export function SubscriptionManager({
  subscriptionId,
  walletAddress: walletAddressProp,
  onCancel,
  onPause,
  onResume,
  className,
}: SubscriptionManagerProps) {
  const { client } = useSubPay();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    const load = async () => {
      try {
        if (subscriptionId) {
          const result = await client.subscriptions.get(subscriptionId);
          if (!cancelled) setSub(result);
        } else {
          const results = await client.subscriptions.list({
            ...(walletAddressProp ? {} : {}),
            limit: 1,
          });
          if (!cancelled) setSub(results[0] ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof SubPaySDKError ? err.message : 'Failed to load subscription.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [subscriptionId, walletAddressProp, client]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || !sub) return;
    setActionLoading(true);
    try {
      const updated = await client.subscriptions[confirmAction](sub.id);
      setSub(updated);
      setConfirmAction(null);
      if (confirmAction === 'cancel') onCancel?.(updated);
      if (confirmAction === 'pause') onPause?.(updated);
      if (confirmAction === 'resume') onResume?.(updated);
    } catch (err) {
      setFetchError(err instanceof SubPaySDKError ? err.message : 'Action failed.');
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, sub, client, onCancel, onPause, onResume]);

  // ── Loading ──
  if (loading) {
    return (
      <div className={className} aria-busy="true" style={{ padding: 20, color: 'var(--subpay-text-secondary, #4a4a4a)', fontSize: 14 }}>
        Loading subscription…
      </div>
    );
  }

  // ── Error ──
  if (fetchError) {
    return (
      <div className={className} role="alert" style={{ padding: 20, color: 'var(--subpay-danger, #b91c1c)', fontSize: 14 }}>
        {fetchError}
      </div>
    );
  }

  // ── Empty ──
  if (!sub) {
    return (
      <div className={className} style={{ padding: 20, color: 'var(--subpay-text-secondary, #4a4a4a)', fontSize: 14 }}>
        No active subscriptions found for this wallet.
      </div>
    );
  }

  const nextCharge = sub.nextChargeAt instanceof Date ? sub.nextChargeAt : new Date(sub.nextChargeAt);
  const nextRetryAt = sub.nextChargeAt instanceof Date ? sub.nextChargeAt : new Date(sub.nextChargeAt);

  return (
    <div className={`subpay-manager${className ? ` ${className}` : ''}`} style={{ color: 'var(--subpay-text-primary, #1a1a1a)' }}>
      {/* Header */}
      <div
        className="subpay-manager-header"
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}
      >
        <span className="subpay-manager-plan" style={{ fontWeight: 700, fontSize: 16 }}>
          {sub.plan.name}
        </span>
        <SubscriptionStatusBadge status={sub.status} />
      </div>

      {/* Details */}
      <dl
        className="subpay-manager-details"
        style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 14, marginBottom: 20 }}
      >
        <dt style={{ color: 'var(--subpay-text-secondary, #4a4a4a)', fontWeight: 500 }}>Amount</dt>
        <dd style={{ margin: 0 }}>
          ${sub.plan.amountUsdc.toFixed(2)} USDC / {formatInterval(sub.plan.intervalDays)}
        </dd>

        <dt style={{ color: 'var(--subpay-text-secondary, #4a4a4a)', fontWeight: 500 }}>Next charge</dt>
        <dd style={{ margin: 0 }}>{formatDate(nextCharge)}</dd>

        <dt style={{ color: 'var(--subpay-text-secondary, #4a4a4a)', fontWeight: 500 }}>Status</dt>
        <dd style={{ margin: 0 }}>{sub.status.replace('_', ' ')}</dd>
      </dl>

      {/* Actions */}
      <div className="subpay-manager-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {sub.status === 'active' && (
          <>
            <button
              type="button"
              onClick={() => setConfirmAction('pause')}
              style={{
                minHeight: 44, padding: '10px 20px', fontSize: 14, fontWeight: 500,
                borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--subpay-border, #d1d5db)',
                background: 'transparent', color: 'var(--subpay-text-primary, #1a1a1a)',
              }}
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('cancel')}
              className="subpay-action-destructive"
              style={{
                minHeight: 44, padding: '10px 20px', fontSize: 14, fontWeight: 500,
                borderRadius: 8, cursor: 'pointer', border: '1px solid var(--subpay-danger, #b91c1c)',
                background: 'transparent', color: 'var(--subpay-danger, #b91c1c)',
              }}
            >
              Cancel
            </button>
          </>
        )}
        {sub.status === 'paused' && (
          <button
            type="button"
            onClick={() => setConfirmAction('resume')}
            style={{
              minHeight: 44, padding: '10px 20px', fontSize: 14, fontWeight: 500,
              borderRadius: 8, cursor: 'pointer',
              border: 'none', background: 'var(--subpay-accent, #2563EB)', color: '#fff',
            }}
          >
            Resume
          </button>
        )}
        {sub.status === 'past_due' && (
          <p
            className="subpay-manager-notice"
            role="alert"
            style={{ fontSize: 14, color: 'var(--subpay-danger, #b91c1c)', margin: 0 }}
          >
            Your last payment failed. Please ensure your wallet has sufficient USDC.
            Next retry: {formatDate(nextRetryAt)}.
          </p>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <SubscriptionActionConfirmModal
          action={confirmAction}
          subscription={sub}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
          isLoading={actionLoading}
        />
      )}
    </div>
  );
}
