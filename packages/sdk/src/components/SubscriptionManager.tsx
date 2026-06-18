import React, { useState } from 'react';
import { useSubPay } from '../provider.js';
import { SubPaySDKError, Subscription } from '../types.js';

interface SubscriptionManagerProps {
  subscription: Subscription;
  onUpdate?: (updated: Subscription) => void;
  onError?: (error: SubPaySDKError) => void;
  className?: string;
}

export function SubscriptionManager({
  subscription: initial,
  onUpdate,
  onError,
  className,
}: SubscriptionManagerProps) {
  const { client } = useSubPay();
  const [sub, setSub] = useState<Subscription>(initial);
  const [loading, setLoading] = useState<string | null>(null);

  const perform = async (action: 'cancel' | 'pause' | 'resume') => {
    setLoading(action);
    try {
      const updated = await client.subscriptions[action](sub.id);
      setSub(updated);
      onUpdate?.(updated);
    } catch (err) {
      const sdkErr =
        err instanceof SubPaySDKError
          ? err
          : new SubPaySDKError({ code: 'NETWORK_ERROR', message: String(err) });
      onError?.(sdkErr);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={className}>
      <div>
        <span>Status: {sub.status}</span>
        <span>Next charge: {sub.nextChargeAt.toLocaleDateString()}</span>
      </div>
      <div>
        {sub.status === 'active' && (
          <>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => perform('pause')}
            >
              {loading === 'pause' ? 'Pausing...' : 'Pause'}
            </button>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => perform('cancel')}
            >
              {loading === 'cancel' ? 'Cancelling...' : 'Cancel'}
            </button>
          </>
        )}
        {sub.status === 'paused' && (
          <>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => perform('resume')}
            >
              {loading === 'resume' ? 'Resuming...' : 'Resume'}
            </button>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => perform('cancel')}
            >
              {loading === 'cancel' ? 'Cancelling...' : 'Cancel'}
            </button>
          </>
        )}
        {sub.status === 'past_due' && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => perform('cancel')}
          >
            {loading === 'cancel' ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}
