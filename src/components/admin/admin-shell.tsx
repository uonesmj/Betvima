'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, Bell, ChevronRight,
  ClipboardList, CreditCard, Database, FileText, Headphones, Home, Image,
  LayoutDashboard, Menu, Search, Server, Settings, Shield, ShieldAlert,
  SlidersHorizontal, Trophy, UserCheck, Users, Wallet, X, Handshake,
} from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { TwoFactorSettings } from '@/components/account/two-factor-settings';
import { EmptyState, Skeleton } from '@/components/ui/primitives';

type AdminLink = { href: string; label: string; icon: LucideIcon };
type AdminSection = { group: string; items: AdminLink[] };

const SECTIONS: AdminSection[] = [
  {
    group: 'Workspace',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/health', label: 'System health', icon: Activity },
      { href: '/admin/workers', label: 'Workers & jobs', icon: Server },
      { href: '/admin/providers', label: 'Providers', icon: Database },
      { href: '/admin/logos', label: 'Brand assets', icon: Image },
    ],
  },
  {
    group: 'Customers',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/kyc', label: 'Identity reviews', icon: UserCheck },
      { href: '/admin/bets', label: 'Bets', icon: ClipboardList },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/support', label: 'Live support', icon: Headphones },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      { href: '/admin/wallet-adjustments', label: 'Wallet adjustments', icon: Wallet },
    ],
  },
  {
    group: 'Sports & trading',
    items: [
      { href: '/admin/matches', label: 'Matches & results', icon: Trophy },
      { href: '/admin/risk-rules', label: 'Risk rules', icon: ShieldAlert },
      { href: '/admin/risk-decisions', label: 'Risk decisions', icon: AlertTriangle },
      { href: '/admin/settlements', label: 'Settlements', icon: ClipboardList },
    ],
  },
  {
    group: 'Affiliates',
    items: [
      { href: '/admin/affiliates', label: 'Affiliates', icon: Handshake },
      { href: '/admin/affiliate-payouts', label: 'Payouts', icon: CreditCard },
      { href: '/admin/affiliate-fraud', label: 'Fraud flags', icon: ShieldAlert },
    ],
  },
  {
    group: 'Administration',
    items: [
      { href: '/admin/operations', label: 'Kill switches', icon: SlidersHorizontal },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/audit', label: 'Audit log', icon: FileText },
      { href: '/admin/reconciliation', label: 'Reconciliation', icon: Database },
      { href: '/admin/roles', label: 'Roles & access', icon: Shield },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminShell({ children, title, actions }: { children: React.ReactNode; title: string; actions?: React.ReactNode }) {
  const { t, session, refreshSession } = useApp();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void refreshSession().finally(() => setChecked(true));
  }, [refreshSession]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(true);
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

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

  if (!session.user.mfaEnrolled || session.user.mfaLevel !== 'aal2') {
    return <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-4 text-xl font-bold">Administrator security verification required</h1>
      <TwoFactorSettings adminRequired onVerified={() => window.location.reload()} />
    </div>;
  }

  const activeLink = SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, group: section.group })))
    .find((item) => isActive(pathname, item.href));
  const searchTerm = navSearch.trim().toLowerCase();
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !searchTerm ||
      item.label.toLowerCase().includes(searchTerm) || section.group.toLowerCase().includes(searchTerm)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="bv-admin">
      {mobileOpen ? (
        <button
          className="bv-admin-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="bv-admin-frame">
        <aside id="admin-primary-navigation" className={`bv-admin-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Admin navigation">
          <div className="bv-admin-brand">
            <Link href="/admin/dashboard" className="bv-admin-brand-link" onClick={() => setMobileOpen(false)}>
              <span className="bv-admin-brand-mark" aria-hidden="true">B</span>
              <span className="bv-admin-brand-words"><strong>BetVima</strong><small>ADMIN CONSOLE</small></span>
            </Link>
            <button className="bv-admin-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X size={19} />
            </button>
          </div>

          <div className="bv-admin-sidebar-search">
            <Search size={17} aria-hidden="true" />
            <input ref={searchRef} aria-label="Find an admin page" value={navSearch}
              onChange={(event) => setNavSearch(event.target.value)} placeholder="Find a page..." />
            <kbd>⌘ K</kbd>
          </div>

          <nav className="bv-admin-nav" aria-label="Admin sections">
            {visibleSections.length ? visibleSections.map((section) => (
              <section key={section.group} className="bv-admin-nav-section" aria-label={section.group}>
                <h2 className="bv-admin-nav-heading">{section.group}</h2>
                <div className="bv-admin-nav-links">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const selected = isActive(pathname, item.href);
                    return (
                      <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined}
                        className={`bv-admin-nav-link ${selected ? 'is-active' : ''}`} onClick={() => setMobileOpen(false)}>
                        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                        <span>{item.label}</span>
                        {selected ? <ChevronRight className="bv-admin-active-arrow" size={15} aria-hidden="true" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )) : <p className="bv-admin-nav-empty">No pages match this search.</p>}
          </nav>

          <div className="bv-admin-sidebar-footer">
            <span className="bv-admin-sidebar-status"><span className="bv-admin-status-dot" /> Secure admin session</span>
            <span className="bv-admin-sidebar-user" title={session.user.email}>{session.user.email || 'Administrator'}</span>
          </div>
        </aside>

        <div className="bv-admin-workspace">
          <header className="bv-admin-topbar">
            <div className="bv-admin-topbar-leading">
              <button ref={menuButtonRef} type="button" className="bv-admin-menu-button"
                aria-label="Open admin navigation" aria-expanded={mobileOpen} aria-controls="admin-primary-navigation"
                onClick={() => setMobileOpen(true)}>
                <Menu size={21} />
              </button>
              <div className="bv-admin-topbar-location">
                <span className="bv-admin-topbar-kicker">BetVima / Admin</span>
                <span className="bv-admin-topbar-current">{activeLink?.label ?? 'Overview'}</span>
              </div>
            </div>
            <div className="bv-admin-topbar-actions">
              <span className="bv-admin-role" title="Your administrator role"><Shield size={13} /> {session.user.role}</span>
              <Link href="/" className="bv-admin-site-link" aria-label="Visit BetVima website">
                <Home size={16} aria-hidden="true" /><span>View site</span><ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </header>

          <main className="bv-admin-main" id="admin-main-content">
            <div className="bv-admin-page-heading">
              <div>
                <div className="bv-admin-breadcrumbs">
                  <Link href="/admin/dashboard">Administration</Link>
                  <ChevronRight size={13} aria-hidden="true" />
                  <span>{activeLink?.group ?? 'Workspace'}</span>
                </div>
                <h1>{title}</h1>
                <p>Manage your BetVima workspace</p>
              </div>
              {actions ? <div className="bv-admin-page-actions">{actions}</div> : null}
            </div>
            <div className="bv-admin-page-content">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
