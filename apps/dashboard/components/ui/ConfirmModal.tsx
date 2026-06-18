'use client';

import { useState } from 'react';

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmText?: string;
  requireTyping?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  destructive?: boolean;
}

export function ConfirmModal({
  title,
  description,
  confirmText = 'Confirm',
  requireTyping = false,
  onConfirm,
  onCancel,
  loading = false,
  destructive = false,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = !requireTyping || typed === 'confirm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
        <p className="text-text-muted text-sm mb-4">{description}</p>

        {requireTyping && (
          <div className="mb-4">
            <label className="block text-sm text-text-muted mb-1">
              Type <span className="font-mono text-text-primary">confirm</span> to proceed
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger text-sm"
              placeholder="confirm"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              destructive
                ? 'bg-danger hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
