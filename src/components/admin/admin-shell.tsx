'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { EmptyState, Skeleton } from '@/components/ui/primitives';

const SECTIONS: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard' },
      { href: '/admin/health', label: 'System health' },
      { href: '/admin/workers', label: 'Workers & jobs' },
      { href: '/admin/providers', label: 'Providers' },
      { href: '/admin/logos', label: 'Logos' },
    ],
  },
  {
    group: 'Customers',
    items: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/bets', label: 'Bets' },
      { href: '/admin/payments', label: 'Payments' },
      { href: '/admin/support', label: 'Live Support' },
      { href: '/admin/wallet-adjustments', label: 'Wallet adjustments' },
    ],
  },
  {
    group: 'Trading',
    items: [
      { href: '/admin/matches', label: 'Matches & results' },
      { href: '/admin/risk-rules', label: 'Risk rules' },
      { href: '/admin/risk-decisions', label: 'Risk decisions' },
      { href: '/admin/settlements', label: 'Settlements' },
    ],
  },
  {
    group: 'Affiliates',
    items: [
      { href: '/admin/affiliates', label: 'Affiliates' },
      { href: '/admin/affiliate-payouts', label: 'Payouts' },
      { href: '/admin/affiliate-fraud', label: 'Fraud flags' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { href: '/admin/operations', label: 'Kill switches' },
      { href: '/admin/settings', label: 'تنظیمات' },
      { href: '/admin/audit', label: 'Audit log' },
      { href: '/admin/reconciliation', label: 'Reconciliation' },
      { href: '/admin/roles', label: 'Roles' },
      { href: '/admin/reports', label: 'Reports' },
    ],
  },
];

export function AdminShell({ children, title, actions }: { children: React.ReactNode; title: string; actions?: React.ReactNode }) {
  const { t, session, refreshSession } = useApp();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void refreshSession().finally(() => setChecked(true));
  }, [refreshSession]);

  if (!checked) {
    return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;
  }

  if (!session?.authenticated || !session.user?.isAdmin) {
    return (
      <div className="p-6">
        <EmptyState
          title={session?.authUnavailable ? t('auth.authUnavailable') : 'Administrator access required'}
          hint="The admin surface is protected twice: by the session role and by database-level checks on every privileged function."
          action={<Link href="/auth/login" className="nova-btn-primary mt-2">{t('nav.login')}</Link>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-nova-bg">
      <header className="sticky top-0 z-40 border-b border-nova-line bg-nova-bg/95 backdrop-blur">
        <div className="nova-container flex h-14 items-center gap-3">
          <Link href="/admin/dashboard" className="font-bold text-nova-gold">NOVA Admin</Link>
          <span className="nova-chip">{session.user.role}</span>
          <span className="ms-auto text-xs nova-muted">{session.user.email}</span>
          <Link href="/" className="nova-btn-ghost !py-1 text-xs">Site</Link>
        </div>
      </header>

      <div className="nova-container flex gap-4 py-4">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-4">
            {SECTIONS.map((section) => (
              <div key={section.group}>
                <div className="mb-1 text-[11px] uppercase tracking-wide nova-muted">{section.group}</div>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-lg px-2.5 py-1.5 text-sm ${pathname === item.href ? 'bg-nova-surface2 text-nova-text' : 'nova-muted hover:text-nova-text'}`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-lg font-bold">{title}</h1>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
