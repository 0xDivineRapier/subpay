'use client';

import { useEffect, useState } from 'react';
import { subpay } from '@/lib/subpay';
import { cn } from '@/lib/utils';

export function RelayBalanceCard() {
  const [balance, setBalance] = useState<{ solBalance: number; estimatedChargesRemaining: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = async () => {
    try {
      const result = await subpay.relay.getBalance();
      setBalance(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBalance();
    const interval = setInterval(() => void fetchBalance(), 30_000);
    return () => clearInterval(interval);
  }, []);

  const sol = balance?.solBalance ?? 0;
  const isRed = sol < 0.1;
  const isYellow = sol >= 0.1 && sol < 0.5;
  const isGreen = sol >= 0.5;

  return (
    <div className={cn(
      'bg-surface border rounded-xl p-6',
      isRed ? 'border-danger' : isYellow ? 'border-warning' : 'border-border',
    )}>
      <p className="text-text-muted text-sm mb-2">Relay Balance</p>

      {loading ? (
        <div className="h-10 bg-background rounded animate-pulse w-32" />
      ) : (
        <p className={cn(
          'text-4xl font-bold',
          isRed ? 'text-danger' : isYellow ? 'text-warning' : 'text-success',
        )}>
          {sol.toFixed(4)} SOL
        </p>
      )}

      <p className="text-text-muted text-sm mt-2">
        ~{balance?.estimatedChargesRemaining?.toLocaleString() ?? '—'} charges remaining
      </p>

      {isRed && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
          ⚠ Balance critically low. Top up your relay wallet immediately to avoid charge failures.
        </div>
      )}
      {isYellow && (
        <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
          ⚠ Balance below 0.5 SOL. Consider topping up soon.
        </div>
      )}
    </div>
  );
}
