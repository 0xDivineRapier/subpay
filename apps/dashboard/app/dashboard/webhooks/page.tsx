'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { WebhookEndpointCard } from '@/components/webhooks/WebhookEndpointCard';
import { useToast } from '@/components/ui/Toast';

const ALL_EVENTS = [
  'payment.success',
  'payment.failed',
  'subscription.created',
  'subscription.cancelled',
  'subscription.paused',
  'subscription.resumed',
];

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const { error: toastError, success } = useToast();

  const loadEndpoints = async () => {
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) setEndpoints(await res.json() as Endpoint[]);
    } catch {
      // No endpoints yet
    }
  };

  useEffect(() => { void loadEndpoints(); }, []);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleCreate = async () => {
    if (!url || selectedEvents.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      const data = await res.json() as { secret?: string };
      if (data.secret) {
        setCreatedSecret(data.secret);
        success('Webhook endpoint created');
        await loadEndpoints();
        setUrl('');
        setSelectedEvents([]);
      }
    } catch {
      toastError('Failed to create webhook endpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TopBar title="Webhooks" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add Endpoint
          </button>
        </div>

        {endpoints.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-12">
            No webhook endpoints configured yet.
          </p>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => (
              <WebhookEndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Add Webhook Endpoint</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-app.com/webhooks/subpay"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Events</label>
                <div className="space-y-2">
                  {ALL_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-border"
                      />
                      <span className="text-sm font-mono text-text-muted">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {createdSecret && (
              <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-xs text-success font-medium mb-1">
                  ⚠ This secret will not be shown again. Copy it now.
                </p>
                <p className="font-mono text-xs text-text-primary break-all">{createdSecret}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => { setShowModal(false); setCreatedSecret(null); }}
                className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg hover:text-text-primary"
              >
                {createdSecret ? 'Close' : 'Cancel'}
              </button>
              {!createdSecret && (
                <button
                  onClick={handleCreate}
                  disabled={loading || !url || selectedEvents.length === 0}
                  className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
