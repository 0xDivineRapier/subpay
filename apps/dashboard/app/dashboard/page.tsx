import { subpay } from '@/lib/subpay';
import { TopBar } from '@/components/layout/TopBar';
import { MetricCard } from '@/components/analytics/MetricCard';
import { MrrChart } from '@/components/analytics/MrrChart';
import { formatUsdc } from '@/lib/utils';

export const revalidate = 60;

export default async function OverviewPage() {
  const [mrr, churn, balance, subscriptions] = await Promise.allSettled([
    subpay.analytics.getMrr(),
    subpay.analytics.getChurn(),
    subpay.relay.getBalance(),
    subpay.subscriptions.list({ status: 'active', limit: 1 }),
  ]);

  const mrrData = mrr.status === 'fulfilled' ? mrr.value : null;
  const churnData = churn.status === 'fulfilled' ? churn.value : null;
  const balanceData = balance.status === 'fulfilled' ? balance.value : null;

  const isLowBalance = (balanceData?.solBalance ?? 0) < 0.1;

  // MRR chart data is mocked with a trend line for the overview
  // Full historical data requires a dedicated analytics endpoint (Prompt 3 extension)
  const chartData = mrrData
    ? [{ date: 'Today', mrr: mrrData.currentMrr }]
    : [];

  return (
    <div>
      <TopBar title="Overview" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="MRR (USDC)"
            value={mrrData ? formatUsdc(mrrData.currentMrr) : '—'}
            delta={
              mrrData && mrrData.previousMrr > 0
                ? `${Math.abs(mrrData.changePercent).toFixed(1)}% vs last month`
                : undefined
            }
            deltaPositive={mrrData ? mrrData.changePercent >= 0 : undefined}
          />
          <MetricCard
            label="Active Subscribers"
            value="—"
          />
          <MetricCard
            label="Failed Payments (30d)"
            value={churnData ? String(churnData.cancelledLast30Days) : '—'}
          />
          <MetricCard
            label="Relay Balance"
            value={balanceData ? `${balanceData.solBalance.toFixed(4)} SOL` : '—'}
            warning={isLowBalance}
          />
        </div>

        <MrrChart data={chartData} />
      </div>
    </div>
  );
}
