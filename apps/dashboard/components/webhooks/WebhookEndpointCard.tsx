'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookEndpointCardProps {
  endpoint: WebhookEndpoint;
}

export function WebhookEndpointCard({ endpoint }: WebhookEndpointCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-text-primary truncate">{endpoint.url}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {endpoint.events.map((e) => (
              <span key={e} className="px-2 py-0.5 bg-background border border-border rounded text-xs text-text-muted">
                {e}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${endpoint.is_active ? 'bg-success' : 'bg-text-muted'}`} />
          <span className="text-xs text-text-muted">{endpoint.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/dashboard/webhooks/${endpoint.id}/logs`}
          className="text-xs text-primary hover:underline"
        >
          View delivery log
        </Link>
      </div>
    </div>
  );
}
