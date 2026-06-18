'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let addToast: ((message: string, type?: Toast['type']) => void) | null = null;

export function useToast() {
  return {
    toast: (message: string, type: Toast['type'] = 'info') => addToast?.(message, type),
    error: (message: string) => addToast?.(message, 'error'),
    success: (message: string) => addToast?.(message, 'success'),
  };
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToast = (message: string, type: Toast['type'] = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { addToast = null; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'px-4 py-3 rounded-lg text-sm font-medium shadow-lg border',
            t.type === 'error' && 'bg-danger/10 border-danger text-danger',
            t.type === 'success' && 'bg-success/10 border-success text-success',
            t.type === 'info' && 'bg-surface border-border text-text-primary',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
