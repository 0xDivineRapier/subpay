import { notFound } from 'next/navigation';
import { subpay } from '@/lib/subpay';
import { TopBar } from '@/components/layout/TopBar';
import { SubscriberStatusBadge } from '@/components/subscribers/SubscriberStatusBadge';
import { SubscriberActions } from '@/components/subscribers/SubscriberActions';
import { formatUsdc, formatDate } from '@/lib/utils';

interface Props {
  params: { id: string };
}

export default async function SubscriberDetailPage({ params }: Props) {
  let subscription;
  try {
    subscription = await subpay.subscriptions.get(params.id);
  } catch {
    notFound();
  }

  const copyAddress = subscription.walletAddress;

  return (
    <div>
      <TopBar title="Subscriber Detail" />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <p className="text-text-muted text-xs mb-1">Wallet Address</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-text-primary text-sm break-all">{copyAddress}</p>
                <button
                  className="text-text-muted hover:text-text-primary text-sm shrink-0"
                  onClick={() => undefined}
                  title="Copy"
                >
                  ⧉
                </button>
              </div>
            </div>
            <SubscriberStatusBadge status={subscription.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-text-muted text-xs">Plan</p>
              <p className="text-text-primary mt-1">{subscription.plan.name}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Amount</p>
              <p className="text-text-primary mt-1">{formatUsdc(subscription.plan.amountUsdc)}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Interval</p>
              <p className="text-text-primary mt-1">Every {subscription.plan.intervalDays} days</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Next Charge</p>
              <p className="text-text-primary mt-1">{formatDate(subscription.nextChargeAt)}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Last Charge</p>
              <p className="text-text-primary mt-1">{formatDate(subscription.lastChargeAt)}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Expires</p>
              <p className="text-text-primary mt-1">{formatDate(subscription.plan.expiryDate)}</p>
            </div>
          </div>

          <div className="mt-4">
            <SubscriberActions subscription={subscription} />
          </div>
        </div>
      </div>
    </div>
  );
}
