'use client';

import { signOut } from 'next-auth/react';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-text-primary">{title}</h1>
      <button
        onClick={() => signOut({ callbackUrl: '/auth/login' })}
        className="text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        Sign out
      </button>
    </header>
  );
}
