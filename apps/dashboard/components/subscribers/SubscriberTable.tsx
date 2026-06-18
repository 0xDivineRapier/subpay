'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { subpay } from '@/lib/subpay';
import { SubscriberStatusBadge } from './SubscriberStatusBadge';
import { SubscriberActions } from './SubscriberActions';
import { truncateAddress, formatUsdc, formatDate } from '@/lib/utils';
import type { Subscription } from '@subpay/solana';

type Status = Subscription['status'] | 'all';

const STATUS_TABS: { label: string; value: Status }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Past Due', value: 'past_due' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' },
];

export function SubscriberTable() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Parameters<typeof subpay.subscriptions.list>[0] = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (status !== 'all') filters.status = status;
      const subs = await subpay.subscriptions.list(filters);
      setSubscriptions(subs);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { void load(); }, [load]);

  const filtered = debouncedSearch
    ? subscriptions.filter((s) =>
        s.walletAddress.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : subscriptions;

  const copyAddress = (addr: string) => navigator.clipboard.writeText(addr);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatus(t.value); setPage(0); }}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                status === t.value
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary border border-border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search wallet..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-4 py-3 text-text-muted font-medium">Wallet</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Amount</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Last Charge</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Next Charge</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-surface rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                  No subscribers yet. Share your SubPay integration to get started.
                </td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr key={sub.id} className="border-b border-border hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/subscribers/${sub.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {truncateAddress(sub.walletAddress)}
                      </Link>
                      <button
                        onClick={() => copyAddress(sub.walletAddress)}
                        className="text-text-muted hover:text-text-primary text-xs"
                        title="Copy address"
                      >
                        ⧉
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-primary">{sub.plan.name}</td>
                  <td className="px-4 py-3">
                    <SubscriberStatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {formatUsdc(sub.plan.amountUsdc)}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(sub.lastChargeAt)}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(sub.nextChargeAt)}</td>
                  <td className="px-4 py-3">
                    <SubscriberActions subscription={sub} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-sm text-text-muted hover:text-text-primary disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-sm text-text-muted">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={filtered.length < PAGE_SIZE}
          className="text-sm text-text-muted hover:text-text-primary disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
