'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { MrrChart } from '@/components/analytics/MrrChart';
import { ChurnChart } from '@/components/analytics/ChurnChart';
import { MetricCard } from '@/components/analytics/MetricCard';
import { subpay } from '@/lib/subpay';
import { downloadCsv, formatUsdc } from '@/lib/utils';

export default function AnalyticsPage() {
  const [mrr, setMrr] = useState<{ currentMrr: number; previousMrr: number; changePercent: number } | null>(null);
  const [churn, setChurn] = useState<{ churnRate: number; cancelledLast30Days: number; totalActive: number } | null>(null);

  useEffect(() => {
    void subpay.analytics.getMrr().then(setMrr);
    void subpay.analytics.getChurn().then(setChurn);
  }, []);

  const handleExportCsv = async () => {
    const subs = await subpay.subscriptions.list({ limit: 200 });
    downloadCsv(
      subs.map((s) => ({
        id: s.id,
        wallet: s.walletAddress,
        plan: s.plan.name,
        amount: s.plan.amountUsdc,
        status: s.status,
        created: s.createdAt,
        lastCharge: s.lastChargeAt,
        nextCharge: s.nextChargeAt,
      })),
      'subpay-subscriptions.csv',
    );
  };

  return (
    <div>
      <TopBar title="Analytics" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 text-sm font-medium bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
          >
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Current MRR"
            value={mrr ? formatUsdc(mrr.currentMrr) : '—'}
            delta={mrr ? `${Math.abs(mrr.changePercent).toFixed(1)}% vs last month` : undefined}
            deltaPositive={mrr ? mrr.changePercent >= 0 : undefined}
          />
          <MetricCard
            label="Churn Rate (30d)"
            value={churn ? `${churn.churnRate.toFixed(1)}%` : '—'}
          />
          <MetricCard
            label="Active Subscribers"
            value={churn ? String(churn.totalActive) : '—'}
          />
        </div>

        <MrrChart data={[]} />
        <ChurnChart data={[]} />
      </div>
    </div>
  );
}
