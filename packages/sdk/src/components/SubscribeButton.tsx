import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSubscribe } from '../hooks/useSubscribe.js';
import { SubPaySDKError, Subscription, SubscriptionPlan } from '../types.js';
import { formatDate, formatInterval, formatIntervalPhrase } from '../utils/format.js';

interface SubscribeButtonProps {
  plan: SubscriptionPlan;
  onSuccess?: (subscription: Subscription) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}

// ─── Focus trap ──────────────────────────────────────────────────────────────

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

// ─── Authorization modal ─────────────────────────────────────────────────────

interface AuthModalProps {
  plan: SubscriptionPlan;
  isLoading: boolean;
  inlineError: string | null;
  onAuthorize: () => void;
  onCancel: () => void;
}

function AuthModal({ plan, isLoading, inlineError, onAuthorize, onCancel }: AuthModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useFocusTrap(modalRef, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
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
        className="subpay-auth-modal"
        style={{
          background: 'var(--subpay-bg-primary, #fff)',
          color: 'var(--subpay-text-primary, #1a1a1a)',
          borderRadius: 12,
          padding: '28px 28px 24px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Section 1: Plan header */}
        <h2
          id={headingId}
          style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--subpay-text-primary, #1a1a1a)' }}
        >
          {plan.name}
        </h2>
        <p
          className="subpay-amount"
          style={{ margin: '0 0 20px', fontSize: 28, fontWeight: 700, color: 'var(--subpay-accent, #2563EB)' }}
        >
          ${plan.amountUsdc.toFixed(2)} USDC / {formatInterval(plan.intervalDays)}
        </p>

        {/* Section 2: What you're authorizing */}
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--subpay-text-secondary, #4a4a4a)' }}>
          What you&apos;re authorizing
        </h3>
        <ul style={{ margin: '0 0 20px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: 'var(--subpay-text-primary, #1a1a1a)' }}>
          <li>
            One charge of up to ${plan.maxAmountUsdc.toFixed(2)} USDC {formatIntervalPhrase(plan.intervalDays)}
          </li>
          <li>Starting today, repeating {formatInterval(plan.intervalDays)}</li>
          <li>Expires {formatDate(plan.expiryDate)}</li>
        </ul>

        {/* Section 3: What you're NOT authorizing */}
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--subpay-text-secondary, #4a4a4a)' }}>
          What you&apos;re not authorizing
        </h3>
        <ul style={{ margin: '0 0 20px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: 'var(--subpay-text-primary, #1a1a1a)' }}>
          <li>Access to your full wallet balance</li>
          <li>Charges above ${plan.maxAmountUsdc.toFixed(2)} USDC</li>
          <li>Any charges after {formatDate(plan.expiryDate)}</li>
        </ul>

        {/* Section 4: Gasless notice */}
        <p
          className="subpay-gasless-notice"
          style={{
            margin: '0 0 8px', fontSize: 13, color: 'var(--subpay-text-secondary, #4a4a4a)',
            background: 'var(--subpay-bg-surface, #f5f5f5)', borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          ⛽ Transaction fees are covered. You only need USDC.
        </p>

        {/* Section 5: Cancel info */}
        <p
          className="subpay-cancel-notice"
          style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--subpay-text-secondary, #4a4a4a)' }}
        >
          You can cancel anytime.
        </p>

        {/* Inline error */}
        {inlineError && (
          <p
            role="alert"
            style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--subpay-danger, #b91c1c)' }}
          >
            {inlineError}
          </p>
        )}

        {/* Section 6: Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              minHeight: 44, minWidth: 44, padding: '10px 20px', fontSize: 14,
              fontWeight: 500, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--subpay-border, #d1d5db)',
              background: 'transparent', color: 'var(--subpay-text-primary, #1a1a1a)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAuthorize}
            disabled={isLoading}
            aria-label={`Subscribe to ${plan.name} for ${plan.amountUsdc} USDC ${formatIntervalPhrase(plan.intervalDays)}`}
            style={{
              minHeight: 44, padding: '10px 20px', fontSize: 14, fontWeight: 600,
              borderRadius: 8, cursor: isLoading ? 'wait' : 'pointer',
              border: 'none', background: 'var(--subpay-accent, #2563EB)', color: '#fff',
              opacity: isLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {isLoading && (
              <span
                className="subpay-spinner"
                aria-hidden="true"
                style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block' }}
              />
            )}
            {isLoading ? 'Preparing authorization…' : 'Authorize & Subscribe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({ plan, subscription }: { plan: SubscriptionPlan; subscription: Subscription }) {
  const nextChargeDate = subscription.nextChargeAt instanceof Date
    ? subscription.nextChargeAt
    : new Date(subscription.nextChargeAt);

  return (
    <div
      className="subpay-success"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '16px 20px', borderRadius: 10,
        background: 'var(--subpay-bg-surface, #f5f5f5)',
        border: '1px solid var(--subpay-border, #d1d5db)',
        color: 'var(--subpay-text-primary, #1a1a1a)',
      }}
    >
      <span style={{ fontSize: 18, color: 'var(--subpay-success, #15803d)' }}>
        <span className="subpay-success-icon" aria-hidden="true">✓</span>{' '}
        Subscribed to {plan.name}
      </span>
      <span className="subpay-success-detail" style={{ fontSize: 13, color: 'var(--subpay-text-secondary, #4a4a4a)' }}>
        ${plan.amountUsdc.toFixed(2)} USDC · {formatInterval(plan.intervalDays)} · Renews {formatDate(nextChargeDate)}
      </span>
      <button
        type="button"
        className="subpay-manage-link"
        onClick={() => window.open('https://app.subpay.xyz/manage', '_blank', 'noopener')}
        style={{
          marginTop: 8, background: 'none', border: 'none', padding: 0,
          color: 'var(--subpay-accent, #2563EB)', fontSize: 13, cursor: 'pointer',
          textDecoration: 'underline', textAlign: 'left',
        }}
      >
        Manage subscription
      </button>
    </div>
  );
}

// ─── SubscribeButton ─────────────────────────────────────────────────────────

export function SubscribeButton({
  plan,
  onSuccess,
  onError,
  className,
  children = 'Subscribe',
}: SubscribeButtonProps) {
  const { subscribe, status } = useSubscribe();
  const [modalOpen, setModalOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [completedSub, setCompletedSub] = useState<Subscription | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isLoading = status === 'loading';

  const openModal = useCallback(() => {
    setInlineError(null);
    setModalOpen(true);
    window.dispatchEvent(new CustomEvent('subpay:auth_view', { detail: { planName: plan.name } }));
  }, [plan.name]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const handleCancel = useCallback(() => {
    window.dispatchEvent(new CustomEvent('subpay:auth_cancel', { detail: { planName: plan.name } }));
    closeModal();
  }, [plan.name, closeModal]);

  const handleAuthorize = useCallback(async () => {
    setInlineError(null);
    try {
      const subscription = await subscribe(plan);
      setCompletedSub(subscription);
      setModalOpen(false);
      window.dispatchEvent(new CustomEvent('subpay:auth_success', {
        detail: { planName: plan.name, subscriptionId: subscription.id },
      }));
      onSuccess?.(subscription);
    } catch (err) {
      const msg =
        err instanceof SubPaySDKError && err.code === 'WALLET_REJECTED'
          ? 'Authorization cancelled. You can try again.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
      setInlineError(msg);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [plan, subscribe, onSuccess, onError]);

  if (completedSub) {
    return <SuccessState plan={plan} subscription={completedSub} />;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        disabled={isLoading}
        aria-haspopup="dialog"
        aria-busy={isLoading}
        className={className}
        style={{ minHeight: 44, minWidth: 44 }}
      >
        {children}
      </button>

      {modalOpen && (
        <AuthModal
          plan={plan}
          isLoading={isLoading}
          inlineError={inlineError}
          onAuthorize={handleAuthorize}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
