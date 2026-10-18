'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const ITEMS = [
  { href: '/affiliate/dashboard', key: 'affiliate.dashboard', name: 'Dashboard', fa: 'داشبورد', icon: '▦', detail: 'Overview and performance', faDetail: 'نمای کلی و عملکرد' },
  { href: '/affiliate/referrals', key: 'affiliate.referrals', name: 'Referrals', fa: 'کاربران معرفی‌شده', icon: '♧', detail: 'Players and activity', faDetail: 'کاربران و فعالیت‌ها' },
  { href: '/affiliate/ledger', key: 'affiliate.ledger', name: 'Commission ledger', fa: 'دفتر کمیسیون', icon: '≡', detail: 'Earnings and settlements', faDetail: 'درآمدها و تسویه‌ها' },
  { href: '/affiliate/payouts', key: 'affiliate.payouts', name: 'Payouts', fa: 'برداشت‌ها', icon: '$', detail: 'Requests and history', faDetail: 'درخواست‌ها و سابقه' },
  { href: '/affiliate/links', key: 'affiliate.links', name: 'Referral links', fa: 'لینک‌های معرفی', icon: '↗', detail: 'Links and campaigns', faDetail: 'لینک‌ها و کمپین‌ها' },
] as const;

export function AffiliateNav() {
  const { locale } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const persian = locale === 'fa';
  const copy = (en: string, fa: string) => persian ? fa : en;
  const current = ITEMS.find(item => pathname === item.href) ?? ITEMS[0];

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    } finally {
      window.location.replace('/affiliate/login');
    }
  };

  const navigation = (inDrawer: boolean) => ITEMS.map(item => {
    const active = pathname === item.href;
    return (
      <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
        onClick={() => setOpen(false)}
        className={inDrawer
          ? `group flex min-h-[64px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${active ? 'border-[#87C4FF]/30 bg-[#087FF5]/20 text-white' : 'border-transparent text-[#C6D1E1] hover:border-white/10 hover:bg-white/10'}`
          : `flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${active ? 'bg-[#EAF4FF] text-[#087FF5]' : 'text-[#64748B] hover:bg-[#F5F8FB] hover:text-[#172033]'}`}
      >
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${inDrawer ? active ? 'bg-[#1489F8] text-white' : 'bg-white/10 text-[#9ACFFF]' : active ? 'bg-white text-[#087FF5]' : 'bg-[#EDF3F9] text-[#64748B]'}`}>{item.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{copy(item.name, item.fa)}</span>
          {inDrawer && <span className="mt-0.5 block text-[11px] font-normal opacity-70">{copy(item.detail, item.faDetail)}</span>}
        </span>
        {inDrawer && <span aria-hidden="true" className="text-[#83A5C8]">{persian ? '‹' : '›'}</span>}
      </Link>
    );
  });

  return (
    <>
      <div className="affiliate-desktop-nav hidden items-center gap-1 lg:flex">
        {navigation(false)}
        <div className="mx-2 h-7 w-px bg-[#E5EAF0]" />
        <button type="button" onClick={handleLogout} disabled={loggingOut}
          className="rounded-xl px-3 py-2.5 text-xs font-bold text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50">
          {loggingOut ? '...' : copy('Log out', 'خروج')}
        </button>
      </div>

      <div className="lg:hidden">
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-expanded={open}
          aria-controls="affiliate-navigation-drawer" aria-label={copy('Open affiliate menu', 'باز کردن منوی افیلیت')}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DCE5EE] bg-white px-3 text-xs font-black text-[#172033] shadow-sm transition active:scale-[.98]">
          <span aria-hidden="true" className="flex h-8 w-8 flex-col items-center justify-center gap-[4px] rounded-lg bg-[#EAF4FF]">
            <span className="h-[2px] w-[16px] rounded-full bg-[#087FF5]" />
            <span className="h-[2px] w-[16px] rounded-full bg-[#087FF5]" />
            <span className="h-[2px] w-[16px] rounded-full bg-[#087FF5]" />
          </span>
          <span>{copy(current.name, current.fa)}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button ref={closeRef} type="button" aria-label={copy('Close affiliate menu', 'بستن منوی افیلیت')}
            onClick={() => setOpen(false)} className="absolute inset-0 h-full w-full bg-[#03101F]/75 backdrop-blur-[3px]" />
          <aside id="affiliate-navigation-drawer" role="dialog" aria-modal="true"
            aria-label={copy('Affiliate navigation', 'ناوبری پنل افیلیت')}
            dir={persian ? 'rtl' : 'ltr'}
            className={`absolute inset-y-0 flex w-[min(86vw,340px)] flex-col overflow-y-auto bg-[#071525] text-white shadow-[0_24px_90px_rgba(0,0,0,.4)] ${persian ? 'right-0 rounded-l-[28px]' : 'left-0 rounded-r-[28px]'}`}>
            <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#123D71] via-[#0D294A] to-[#071525] px-5 pb-6 pt-[max(24px,env(safe-area-inset-top))]">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#168BFF]/20 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div className="text-xl font-black tracking-tight">BetVima <span className="text-[#57B7FF]">Partners</span></div>
                <button type="button" onClick={() => setOpen(false)} aria-label={copy('Close menu', 'بستن منو')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xl">×</button>
              </div>
              <div className="relative mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#85C5FF]">{copy('AFFILIATE WORKSPACE', 'پنل اختصاصی افیلیت')}</div>
              <div className="relative mt-1 text-lg font-bold">{copy('Manage your partnerships', 'مدیریت همکاری و درآمد')}</div>
              <p className="relative mt-1 text-xs leading-5 text-[#B8CEE3]">{copy('Performance, referrals and earnings in one place.', 'آمار، کاربران معرفی‌شده و درآمدها در یک مکان.')}</p>
            </div>
            <nav aria-label={copy('Affiliate sections', 'بخش‌های افیلیت')} className="flex-1 space-y-1.5 px-3 py-5">
              {navigation(true)}
            </nav>
            <div className="border-t border-white/10 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
              <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-[11px] text-[#A7BBD0]">{copy('Your affiliate account', 'حساب افیلیت شما')}</div>
              <button type="button" onClick={handleLogout} disabled={loggingOut}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#F87171]/20 bg-[#F87171]/10 px-4 text-sm font-bold text-[#FDA4AF] disabled:opacity-50">
                <span aria-hidden="true">↪</span> {loggingOut ? '...' : copy('Sign out', 'خروج از حساب')}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
