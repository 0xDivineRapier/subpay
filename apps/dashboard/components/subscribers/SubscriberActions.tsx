'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { subpay } from '@/lib/subpay';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import type { Subscription } from '@subpay/solana';

interface SubscriberActionsProps {
  subscription: Subscription;
}

type Action = 'cancel' | 'pause' | 'resume';

const ACTION_LABELS: Record<Action, string> = {
  cancel: 'Cancel subscription',
  pause: 'Pause subscription',
  resume: 'Resume subscription',
};

export function SubscriberActions({ subscription }: SubscriberActionsProps) {
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { error: toastError, success } = useToast();

  const availableActions: Action[] = (() => {
    switch (subscription.status) {
      case 'active': return ['pause', 'cancel'];
      case 'paused': return ['resume', 'cancel'];
      case 'past_due': return ['cancel'];
      default: return [];
    }
  })();

  if (availableActions.length === 0) return null;

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      await subpay.subscriptions[pendingAction](subscription.id);
      success(`Subscription ${pendingAction}led successfully`);
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {availableActions.map((action) => (
          <button
            key={action}
            onClick={() => setPendingAction(action)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              action === 'cancel'
                ? 'border-danger text-danger hover:bg-danger/10'
                : action === 'pause'
                ? 'border-warning text-warning hover:bg-warning/10'
                : 'border-success text-success hover:bg-success/10'
            }`}
          >
            {action.charAt(0).toUpperCase() + action.slice(1)}
          </button>
        ))}
      </div>

      {pendingAction && (
        <ConfirmModal
          title={ACTION_LABELS[pendingAction]}
          description={`Are you sure you want to ${pendingAction} this subscription for ${subscription.walletAddress.slice(0, 8)}...?`}
          confirmText={pendingAction.charAt(0).toUpperCase() + pendingAction.slice(1)}
          requireTyping={pendingAction === 'cancel'}
          destructive={pendingAction === 'cancel'}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
