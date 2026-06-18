import React from 'react';
import { useSubscribe } from '../hooks/useSubscribe.js';
import { Subscription, SubscriptionPlan } from '../types.js';

interface SubscribeButtonProps {
  plan: SubscriptionPlan;
  onSuccess?: (subscription: Subscription) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}

export function SubscribeButton({
  plan,
  onSuccess,
  onError,
  className,
  children = 'Subscribe',
}: SubscribeButtonProps) {
  const { subscribe, status } = useSubscribe();
  const isLoading = status === 'loading';

  const handleClick = async () => {
    try {
      const subscription = await subscribe(plan);
      onSuccess?.(subscription);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={className}
      aria-busy={isLoading}
    >
      {isLoading ? 'Processing...' : children}
    </button>
  );
}
