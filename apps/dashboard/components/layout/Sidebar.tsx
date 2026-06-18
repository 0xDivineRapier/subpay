'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '⬡' },
  { href: '/dashboard/subscribers', label: 'Subscribers', icon: '👥' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📈' },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: '🔔' },
  { href: '/dashboard/relay', label: 'Relay', icon: '⚡' },
  { href: '/dashboard/settings', label: 'API Keys', icon: '🔑' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface border border-border rounded-lg text-text-primary"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-56 bg-surface border-r border-border flex flex-col transition-transform duration-200',
          'lg:translate-x-0',
          collapsed ? '-translate-x-full' : 'translate-x-0',
        )}
      >
        <div className="px-6 py-5 border-b border-border">
          <span className="text-lg font-bold text-text-primary">SubPay</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(true)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/5',
                )}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setCollapsed(true)}
        />
      )}
    </>
  );
}
