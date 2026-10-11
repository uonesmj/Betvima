'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const ITEMS = [
  { href: '/affiliate/dashboard', key: 'affiliate.dashboard', icon: '⌂', short: 'Home' },
  { href: '/affiliate/referrals', key: 'affiliate.referrals', icon: '◎', short: 'Players' },
  { href: '/affiliate/ledger', key: 'affiliate.ledger', icon: '≡', short: 'Ledger' },
  { href: '/affiliate/payouts', key: 'affiliate.payouts', icon: '$', short: 'Payouts' },
  { href: '/affiliate/links', key: 'affiliate.links', icon: '↗', short: 'Links' },
];

export function AffiliateNav() {
  const { t } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } finally {
      window.location.replace('/affiliate/login');
    }
  };

  const current = ITEMS.find((item) => item.href === pathname);

  return (
    <>
      <div className="affiliate-desktop-nav hidden items-center gap-1 lg:flex">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                active
                  ? 'bg-[#EAF4FF] text-[#087FF5]'
                  : 'text-[#64748B] hover:bg-[#F5F8FB] hover:text-[#172033]'
              }`}
            >
              <span className={`text-sm ${active ? 'text-[#087FF5]' : 'text-[#94A3B8]'}`}>
                {item.icon}
              </span>
              <span>{t(item.key)}</span>
            </Link>
          );
        })}

        <div className="ml-2 h-7 w-px bg-[#E5EAF0]" />

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="ml-1 rounded-xl px-3 py-2.5 text-xs font-bold text-[#64748B] transition hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50"
        >
          {loggingOut ? '...' : 'Log out'}
        </button>
      </div>

      <div className="relative lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-label="Open affiliate menu"
          className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE5EE] bg-white px-3.5 text-xs font-black text-[#172033] shadow-sm"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EAF4FF] text-sm text-[#087FF5]">
            {current?.icon ?? '☰'}
          </span>
          <span>{current ? t(current.key) : 'Affiliate menu'}</span>
          <span className={`ml-1 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </button>

        {open ? (
          <>
            <button
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-[245px] overflow-hidden rounded-2xl border border-[#D9E3ED] bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,.16)]">
              <div className="px-3 pb-2 pt-2 text-[9px] font-black uppercase tracking-[.2em] text-[#94A3B8]">
                Affiliate Center
              </div>

              {ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                      active
                        ? 'bg-[#EAF4FF] font-black text-[#087FF5]'
                        : 'font-semibold text-[#334155] hover:bg-[#F5F8FB]'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      active ? 'bg-white text-[#087FF5]' : 'bg-[#F5F8FB] text-[#64748B]'
                    }`}>
                      {item.icon}
                    </span>
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}

              <div className="my-1.5 border-t border-[#E8EDF2]" />

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF2F2]">↪</span>
                <span>{loggingOut ? 'Signing out...' : 'Log out'}</span>
              </button>
            </div>
          </>
        ) : null}
      </div>

      <nav
        className="affiliate-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border bg-white/95 px-1 backdrop-blur-xl lg:hidden"
        aria-label="Affiliate navigation"
      >
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-black transition ${
                active ? 'text-[#087FF5]' : 'text-[#7B899B]'
              }`}
            >
              <span className={`flex h-7 w-9 items-center justify-center rounded-xl text-base ${
                active ? 'bg-[#EAF4FF] text-[#087FF5]' : ''
              }`}>
                {item.icon}
              </span>
              <span className="truncate">{item.short}</span>
            </Link>
          );
        })}
              <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Log out"
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-black text-[#DC2626] transition disabled:opacity-50"
        >
          <span className="flex h-7 w-9 items-center justify-center rounded-xl text-base">↪</span>
          <span className="truncate">{loggingOut ? '...' : 'Log out'}</span>
        </button>
</nav>
    </>
  );
}
