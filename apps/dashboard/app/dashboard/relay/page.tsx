import { TopBar } from '@/components/layout/TopBar';
import { RelayBalanceCard } from '@/components/relay/RelayBalanceCard';

export default function RelayPage() {
  return (
    <div>
      <TopBar title="Relay" />
      <div className="p-6 space-y-6 max-w-2xl">
        <RelayBalanceCard />

        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-text-primary mb-3">Top Up Instructions</h2>
          <p className="text-text-muted text-sm mb-4">
            Send SOL to your relay hot wallet address below. The relay must maintain a minimum of
            0.05 SOL to execute charges. Keep between 0.1–1.0 SOL for uninterrupted operation.
          </p>
          <p className="text-xs text-danger font-medium">
            Hard limit: 1.0 SOL maximum balance enforced by the relay.
          </p>
        </div>
      </div>
    </div>
  );
}
