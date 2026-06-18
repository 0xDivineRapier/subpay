'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

interface ApiKey {
  id: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  is_active: boolean;
}

const SCOPES = ['subscriptions:read', 'subscriptions:write', 'analytics:read', 'webhooks:write'];

export default function SettingsPage() {
  const [apiKeys, _setApiKeys] = useState<ApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [loading, setLoading] = useState(false);
  const { error: toastError, success } = useToast();

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName, scopes: selectedScopes }),
      });
      const data = await res.json() as { key?: string };
      if (data.key) {
        setCreatedKey(data.key);
        success('API key created');
        setKeyName('');
        setSelectedScopes([]);
      }
    } catch {
      toastError('Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setLoading(true);
    try {
      await fetch(`/api/api-keys/${revokeTarget.id}`, { method: 'DELETE' });
      success('API key revoked');
      setRevokeTarget(null);
    } catch {
      toastError('Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TopBar title="API Keys" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create API Key
          </button>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-text-muted font-medium">Key</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Scopes</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-text-muted">
                    No API keys yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-border">
                    <td className="px-4 py-3 font-mono text-text-primary">{key.prefix}...</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-background border border-border rounded text-xs text-text-muted">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRevokeTarget(key)}
                        className="text-xs text-danger hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Create API Key</h2>

            {!createdKey ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Name</label>
                    <input
                      type="text"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="My integration"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Scopes</label>
                    <div className="space-y-2">
                      {SCOPES.map((scope) => (
                        <label key={scope} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope)}
                            onChange={() => toggleScope(scope)}
                            className="rounded border-border"
                          />
                          <span className="text-sm font-mono text-text-muted">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading || !keyName || selectedScopes.length === 0}
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg mb-4">
                  <p className="text-warning text-sm font-medium mb-1">
                    ⚠ This will not be shown again. Copy it now.
                  </p>
                </div>
                <div className="bg-background border border-border rounded-lg p-3 font-mono text-sm text-text-primary break-all">
                  {createdKey}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(createdKey)}
                  className="mt-3 w-full px-4 py-2 text-sm border border-border text-text-primary rounded-lg hover:bg-surface"
                >
                  Copy to clipboard
                </button>
                <button
                  onClick={() => { setShowCreate(false); setCreatedKey(null); }}
                  className="mt-2 w-full px-4 py-2 text-sm text-text-muted"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {revokeTarget && (
        <ConfirmModal
          title="Revoke API Key"
          description={`This will permanently revoke the key ${revokeTarget.prefix}... and cannot be undone.`}
          confirmText="Revoke"
          requireTyping={true}
          destructive={true}
          loading={loading}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
