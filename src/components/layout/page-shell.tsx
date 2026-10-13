'use client';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';

import { AuthSheet } from '@/components/account/auth-sheet';
import { useApiQuery } from "@/lib/hooks/useApi";

import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Globe2, Instagram, MessageCircle, Send } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import SupportClient from '@/components/support/support-client';
import { Bell, Menu, Receipt, Home, Radio, Ticket, WalletCards, X, ChevronLeft, ArrowUp, Trophy, Gamepad2, UserRound, Headphones, Settings, LogIn, UserPlus, ShieldCheck, UsersRound } from 'lucide-react';
import { useApp } from './providers';
import { apiRequest } from "@/lib/hooks/useApi";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useBetSlip } from '@/lib/store/betslip';
import { HomeHeader } from "@/components/home/home-header";
import { BetSlipRail } from '@/components/betting/bet-slip';
import { TopWalletBalance } from '@/components/layout/top-wallet-balance';
import { AccountSummary } from '@/components/layout/account-summary';
import { LanguageSelector } from '@/components/layout/language-selector';
import { ReferenceSportsNav } from '@/components/home/reference-sports-nav';

const NAV = [
  { href: '/', key: 'nav.home', icon: Home },
  { href: '/live', key: 'nav.live', icon: Radio },
  { href: '/sports/football', key: 'nav.sports', icon: Trophy },
  { href: '/bets', key: 'nav.myBets', icon: Ticket },
  { href: '/wallet', key: 'nav.wallet', icon: WalletCards },
  { href: '/affiliate/login', key: 'nav.affiliate', icon: UsersRound },];

export function Header({
  onMenuStateChange,
  hideSportsNav = false,
  onSupportOpen,
}: {
  onMenuStateChange?: (open: boolean) => void;
  hideSportsNav?: boolean;
  onSupportOpen?: () => void;
} = {}) {
  const { t, session, sessionLoading, dir } = useApp();
  const isSportsbookUser = Boolean(session?.authenticated);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen((value) => {
      const next = !value;
      onMenuStateChange?.(next);
      return next;
    });
  };

  useEffect(() => {
    const openProfile = () => setProfileSheetOpen(true);
    window.addEventListener("nova:open-profile-sheet", openProfile);
    return () => window.removeEventListener("nova:open-profile-sheet", openProfile);
  }, []);

  useEffect(() => {
    document.body.dataset.novaPageShellMenu = menuOpen ? "1" : "0";
    document.body.dataset.novaPageShellProfile = profileSheetOpen ? "1" : "0";
    const lock = menuOpen || profileSheetOpen;
    if (lock) {
      document.body.dataset.novaDrawerScrollLock = "1";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      delete document.body.dataset.novaDrawerScrollLock;
      delete document.body.dataset.novaPageShellMenu;
      delete document.body.dataset.novaPageShellProfile;
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      delete document.body.dataset.novaDrawerScrollLock;
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [menuOpen, profileSheetOpen]);

  return (
    <>
      <header
        dir={dir}
        className="sticky top-0 z-50 border-b border-[#20252A] bg-[#111111] text-white"
      >
        <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-3 px-3 sm:px-5 lg:px-6">

          <Link
            href="/"
            className="flex shrink-0 items-center"
            aria-label={t('brand.name')}
          >
            <img
              src="/brand/betvima-logo-transparent.png"
              alt="BetVima"
              className="h-auto w-[72px] sm:w-[105px] shrink-0 object-contain"
            />
          </Link>

          <div className="ml-auto flex items-center gap-2">

            {sessionLoading ? (
              <div className="flex items-center gap-2" aria-hidden="true">
                <div className="h-11 w-[118px] animate-pulse rounded-xl bg-[#20242A]" />
                <div className="h-11 w-[128px] animate-pulse rounded-xl bg-[#20242A]" />
              </div>
            ) : isSportsbookUser ? (
              <>
                <TopWalletBalance />
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("nova:open-profile-sheet"))}
                  className="rounded-xl bg-[#272727] px-2.5 py-2 text-xs font-bold sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  {session?.user?.email?.split('@')[0] || t('nav.account')}
                  </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('nova:open-auth-sheet', { detail: { mode: 'login' } }))}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#20242A] px-5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition-all duration-200 hover:bg-[#292E35] hover:-translate-y-px active:translate-y-0"
                >
                  <UserRound className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                  <span>{t('nav.login')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('nova:open-auth-sheet', { detail: { mode: 'register' } }))}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-nova-primary px-5 text-sm font-black text-[#04140C] shadow-[0_5px_18px_rgba(0,230,118,.16)] transition-all duration-200 hover:brightness-105 hover:-translate-y-px hover:shadow-[0_7px_22px_rgba(0,230,118,.22)] active:translate-y-0"
                >
                  <UserPlus className="h-[17px] w-[17px] shrink-0" strokeWidth={2.2} />
                  <span>{t('nav.register')}</span>
                </button>
              </>
            )}

            <div className="hidden sm:block">
              <LanguageSelector />
            </div>
            <button
              type="button"
              onClick={toggleMenu}
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#272727] lg:hidden"
              aria-label={t('nav.menu')}
            >
              <Menu size={21} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>


      {profileSheetOpen ? <MobileProfileSheet close={() => setProfileSheetOpen(false)} /> : null}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.menu')}
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/80 backdrop-blur-sm"
            aria-label={t("common.close")}
            onClick={toggleMenu}
          />

          <ReferenceMobileDrawer close={toggleMenu} onProfileOpen={() => { toggleMenu(); setProfileSheetOpen(true); }} />
        </div>
      ) : null}
    </>
  );
}

function ReferenceDrawerIcon({ type }: { type: string }) {
  const paths: Record<string, React.ReactNode> = {
    casino: <><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8M12 8v8"/><circle cx="7.5" cy="7.5" r="1"/><circle cx="16.5" cy="16.5" r="1"/></>,
    sports: <><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v4M20.5 12h-4M12 20.5v-4M3.5 12h4M6.1 6.1l2.8 2.8M17.9 6.1l-2.8 2.8M17.9 17.9l-2.8-2.8M6.1 17.9l2.8-2.8"/></>,
    markets: <><rect x="5" y="4.5" width="14" height="15" rx="2"/><path d="M8 9h8M8 12h5M8 15h7"/></>,
    betwave: <><circle cx="12" cy="12" r="8.5"/><path d="M7.5 12c1.5-4 3-4 4.5 0s3 4 4.5 0"/></>,
    bonus: <><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M12 7v13M4 11h16M8 7c-2.5-3 1-5 4 0 3-5 6.5-3 4 0"/></>,
    vip: <><path d="m4 7 4 4 4-6 4 6 4-4-2 11H6L4 7Z"/><path d="M7 21h10"/></>,
    club: <><path d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8L12 4Z"/><path d="M8 21h8"/></>,
    promotion: <><path d="M4 9h16v11H4zM12 9v11"/><path d="M7 9c-2.5-3 1-5 5 0 4-5 7-3 5 0M4 13h16"/></>,
    tournament: <><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4M12 14v4M8 21h8"/></>,
        affiliate: <><circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><path d="M10.5 9.5 13.5 14.5"/><path d="M4.5 19.5 7 17l2.5 2.5M14.5 4.5 17 7l2.5-2.5"/></>,
    poker: <><path d="M12 4c1.7 2.2 5 4.2 5 8a5 5 0 1 1-10 0c0-3.8 3.3-5.8 5-8Z"/><path d="M12 9v6M9.5 12h5"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.2-5.2 7-5.2s6.2 1.7 7 5.2"/></>,
    support: <><path d="M5 12a7 7 0 0 1 14 0v5a2 2 0 0 1-2 2h-2v-6h4M5 13H3v4a2 2 0 0 0 2 2h2v-6H5"/></>,
    more: <><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/></>,
    top: <><path d="m12 3 2.2 5.4 5.8.5-4.4 3.8 1.3 5.6L12 15.2 7.1 18.3l1.3-5.6L4 8.9l5.8-.5L12 3Z"/></>,
    live: <><circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9M4.5 4.5a10.5 10.5 0 0 0 0 15M19.5 4.5a10.5 10.5 0 0 1 0 15"/></>,
    upcoming: <><rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M8 3v4M16 3v4M5 9h14M9 13h2M13 13h2M9 16h2"/></>,
    bets: <><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 12h5M8 15h7"/></>,
    esports: <><path d="M7 6h10l2 12H5L7 6Z"/><path d="M9 6 7 3M15 6l2-3M8 11h3M13 11h3M10 9v4M14 9v4"/></>,
  };

  return (
    <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}
function ReferenceMobileDrawer({
  close, onProfileOpen, onSupportOpen
}: { close: () => void; onProfileOpen?: () => void; onSupportOpen?: () => void }) {
  const router = useRouter();

  useEffect(() => {
    ['/','/live','/bets','/wallet','/sports/football'].forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);
  const pathname = usePathname();
  const { session, sessionLoading, t, dir } = useApp();
  const isSportsbookUser = Boolean(session?.authenticated);
  const { data: profileData } = useApiQuery<{ profile?: { displayName?: string; username?: string; numericId?: number } | null }>(isSportsbookUser ? "/api/v1/account/profile" : "", { pollMs: 60000 });
  const profile = profileData?.profile ?? null;
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const [sportsOpen, setSportsOpen] = useState(false);

  const sports = [
    [t('menu.top'), "/", "top"],
    [t('nav.live'), "/live", "live"],
    [t('menu.upcoming'), "/sports/football", "upcoming"],
    [t('menu.topBets'), "/bets", "bets"],
    [t('menu.esports'), "/sports/esports", "esports"],
    [t('menu.betHistory'), "/bets", "history"],
  ] as const;

  return (
    <aside
      dir={dir}
      className="absolute inset-y-0 left-0 flex h-full w-[49.5vw] min-w-[300px] max-w-[475px] flex-col overflow-hidden bg-[#1C1D20] text-white shadow-[18px_0_45px_rgba(0,0,0,.42)] animate-[novaSlideIn_.22s_cubic-bezier(.22,1,.36,1)]"
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="shrink-0 border-b border-white/[0.08] px-5 pb-4 pt-4">
        <button
          type="button"
          onClick={() => sessionLoading ? undefined : (isSportsbookUser ? (onProfileOpen ? onProfileOpen() : window.dispatchEvent(new CustomEvent("nova:open-profile-sheet"))) : go("/auth/login"))}
          className="flex w-full items-center gap-3 text-left rtl:text-right"
        >
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#303237] text-[#AEB4BE]">
            <ReferenceDrawerIcon type="user" />
            {!sessionLoading && isSportsbookUser ? (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#FF5B2E] ring-2 ring-[#1C1D20]" aria-label={t("menu.online")} />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            {sessionLoading ? (
              <span className="block h-5 w-24 animate-pulse rounded bg-white/10" />
            ) : isSportsbookUser ? (
              <>
                <span className="block truncate text-[16px] font-extrabold text-white">
                  {profile?.displayName || session?.user?.email?.split("@")[0] || "Account"}
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-[#AEB4BE]">
                  ID: {profile?.numericId ?? "—"}
                </span>
              </>
            ) : (
              <span className="block text-[17px] font-bold">{t('nav.login')}</span>
            )}
          </span>
          <span className="shrink-0 text-[32px] font-light leading-none text-[#AAB0B9]">‹</span>
          </button>
      </div>

      {!sessionLoading && isSportsbookUser ? (
      <button
        type="button"
        onClick={() => go("/wallet?tab=deposit")}
        className="mx-5 mt-4 flex h-[74px] shrink-0 items-center justify-between overflow-hidden rounded-[18px] border border-[#566056] bg-gradient-to-r from-[#39413C] to-[#AAB7A9] px-4 text-left"
      >
        <span className="text-[17px] font-extrabold leading-5">{t('wallet.deposit')}</span>
        <span className="grid h-12 w-16 shrink-0 place-items-center"><Image src="/brand/deposit-money.png" alt="" width={72} height={46} className="h-11 w-auto object-contain" aria-hidden="true" /></span>
        </button>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden px-5 pt-2">

        <div className="my-1.5 border-t border-white/[0.09]" />
          <div className="mb-2">
            <button type="button" onClick={() => setSportsOpen((v) => !v)} className="flex min-h-[52px] w-full items-center rounded-xl bg-white/[0.06] px-3 text-left rtl:text-right text-[16px] font-semibold text-white">
              <span className="grid h-7 w-7 shrink-0 place-items-center text-[#AEB5C0]"><ReferenceDrawerIcon type="sports" /></span>
              <span className="flex-1">{t('nav.sports')}</span>
              <span className="text-[24px] leading-none text-[#AEB5C0]">{sportsOpen ? "⌃" : "⌄"}</span>
              </button>
            {sportsOpen && (
              <div className="ml-4 border-l border-white/[0.09] pl-2">
                {sports.map(([label, href, icon]) => (
                  <button key={label} type="button" onClick={() => go(href)} className="flex min-h-[50px] w-full items-center gap-4 rounded-xl px-3 text-left rtl:text-right text-[15px] font-medium text-[#F1F2F3]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center text-[#AEB5C0]"><ReferenceDrawerIcon type={icon} /></span>
                    <span className="flex-1">{label}</span>
                    </button>
                ))}
              </div>
            )}
          </div>

        {[
          [t("menu.markets"), "markets", "/sports/football"],
          [t("menu.betwave"), "betwave", "/bets"],
          [t("menu.bonuses"), "bonus", "/bonuses"],
          [t("menu.vipClub"), "club", "/loyalty-program"],
        ].map(([label, icon, href]) => (
          <button
            key={label}
            type="button"
            onClick={() => go(href as string)}
            className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium ${pathname === href ? "bg-[#00D878]/15 text-[#00D878]" : "text-[#F1F2F3]"}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center text-[#AEB5C0]">
              <ReferenceDrawerIcon type={icon as string}/>
            </span>
            <span className="min-w-0 flex-1">{label}</span>
            {label === "Bonuses" ? (
              <span className="rounded-full bg-[#FF5B2E] px-2.5 py-1 text-[12px] font-extrabold">1</span>
            ) : null}
            </button>
        ))}
        <div className="my-2 border-t border-white/[0.09]" />
        <button
          type="button"
          onClick={() => go("/affiliate/login")}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-[#F1F2F3]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center text-[#AEB5C0]">
            <ReferenceDrawerIcon type="affiliate"/>
          </span>
          <span className="min-w-0 flex-1">{t("menu.affiliate")}</span>
          </button>
      </div>

      <div className="shrink-0 border-t border-white/[0.09] px-5 pb-3 pt-3">
        <button
          type="button"
          onClick={() => go("/")}
          className="mb-2 flex h-[68px] w-full items-center gap-3 rounded-[16px] bg-[#303136] px-3 text-left"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center">
            <Image src="/brand/betvima-apk-logo.png" alt="" width={48} height={48} className="h-11 w-11 object-contain" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold">{t("menu.betvimaApk")}</span>
            <span className="mt-1 block text-[11px] leading-4 text-[#B7BBC2]">{t("menu.apkBonus")}</span>
          </span>
          <span className="text-[26px] text-[#AEB4BD]">›</span>
          </button>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="WhatsApp" className="grid h-11 w-11 place-items-center rounded-xl bg-[#303136] text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M8.5 8.5c.4 2.2 2 4 4.2 4.6l1.3-1.2 1.8.8c.3.1.4.5.2.8-.6.8-1.5 1.2-2.5.9-3.3-1-5.6-3.3-6.6-6.6-.3-1 .1-1.9.9-2.5.3-.2.7-.1.8.2l.8 1.8-1.2 1.2Z"/></svg></button>
          <button type="button" aria-label="Telegram" className="grid h-11 w-11 place-items-center rounded-xl bg-[#303136] text-white"><Send size={19}/></button>
          <button type="button" aria-label="Instagram" className="grid h-11 w-11 place-items-center rounded-xl bg-[#303136] text-white"><Instagram size={19}/></button>
          <button type="button" aria-label="More" className="grid h-11 w-11 place-items-center rounded-xl bg-[#303136] text-[#D5D8DD]"><ReferenceDrawerIcon type="more"/></button>
        </div>
        <button type="button" onClick={() => { close(); onSupportOpen?.(); }} className="mt-3 flex h-[58px] w-full items-center gap-4 rounded-xl bg-[#303136] px-4 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#44464C] text-white"><ReferenceDrawerIcon type="support"/></span>
          <span className="flex-1 text-[16px] font-medium">{t('menu.support')}</span>
          <span className="rounded-full bg-[#147DEB] px-3 py-1 text-[12px] font-extrabold">24/7</span>
        </button>
      </div>
    </aside>
  );
}
function MobileProfileSheet({
  close
}: { close: () => void }) {
  const { t } = useApp();
  useEffect(() => { const y = window.scrollY; const body = document.body; body.dataset.novaProfileScrollY = String(y); body.style.position = "fixed"; body.style.top = `-${y}px`; body.style.left = "0"; body.style.right = "0"; body.style.width = "100%"; return () => { const saved = Number(body.dataset.novaProfileScrollY || "0"); body.style.position = ""; body.style.top = ""; body.style.left = ""; body.style.right = ""; body.style.width = ""; delete body.dataset.novaProfileScrollY; window.scrollTo(0, saved); }; }, []);
  const { session } = useApp();
  const currency = session?.user?.currency ?? 'IRR';
  const { data: walletData } = useApiQuery<{
    wallet?: { balanceMinor?: string; availableMinor?: string; currency?: string } | null;
  }>(
    session?.authenticated
      ? `/api/v1/wallet?currency=${encodeURIComponent(currency)}&page=1&pageSize=1`
      : null
  );

  const availableMinor = walletData?.wallet?.availableMinor ?? '0';
  const balance = currency === 'IRR' || currency === 'IRT' ? availableMinor : (Number(availableMinor) / 100).toFixed(2);
  const displayName =
    session?.user?.email?.split('@')[0] || 'Account';

  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      setLoggingOut(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[95] lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={close}
        className="nova-profile-backdrop absolute inset-0 bg-black/65"
        aria-label={t("common.close")}
      />
      <section className="nova-profile-sheet absolute inset-x-0 bottom-0 max-h-[100dvh] overflow-hidden rounded-t-[22px] bg-white text-[#171B22] shadow-[0_-18px_55px_rgba(0,0,0,.35)]">
        <div className="max-h-[100dvh] overflow-y-auto overscroll-contain px-3 pb-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[27px] font-bold">{t("account.profile")}</h2>
            <button
              type="button"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-full text-[#68717E]"
              aria-label={t("common.close")}
            >
              <X size={29} />
              </button>
          </div>

          <div className="flex flex-col items-center pb-3 pt-1">
            <div className="text-[25px] font-bold">{displayName}</div>
            <div className="mt-1 text-[13px] text-[#737C88]">ID {session?.user?.email?.split('@')[0] ?? '—'}</div>
          </div>

          <div className="rounded-[21px] bg-[#F0F2F5] p-4">
            <div className="text-[13px] font-semibold text-[#737C88]">
              Account Balance
            </div>
            <div className="mt-1 text-[25px] font-bold">
              {currency} {balance}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href="/wallet?tab=deposit"
                className="flex h-[58px] items-center justify-center rounded-[16px] bg-[#00C767] text-[16px] font-bold text-white"
              >
                Deposit
              </a>
              <a
                href="/wallet?tab=withdraw"
                className="flex h-[58px] items-center justify-center rounded-[16px] bg-[#E2E5E9] text-[16px] font-bold text-[#202631]"
              >
                Withdraw
              </a>
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-[21px]  bg-[#E9EAED]">
            {[
              ['Bonuses', 'Free spins and other offers', '/bonuses'],
              ['Bonus codes', 'Activate a bonus code', null],
              ['VIP Loyalty Program', 'Your loyalty level', '/loyalty-program'],
            ].map(([title, subtitle, href], index) => (
              href ? (
                <a key={title} href={href} className="flex min-h-[54px] items-center gap-4 border-b border-[#D5D7DB] px-5">
                  <Trophy size={24} className="text-[#687180]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{title}</span>
                    <span className="block text-[13px] text-[#737C88]">{subtitle}</span>
                  </span>
                  <ChevronLeft className="rotate-180 text-[#737C88]" size={20} />
                </a>
              ) : (
                <button key={title} type="button" className={`flex min-h-[54px] w-full items-center gap-4 px-5 text-left ${index < 2 ? 'border-b border-[#D5D7DB]' : ''}`}>
                  {title === 'Bonus codes' ? <ShieldCheck size={24} className="text-[#687180]" /> : <Trophy size={24} className="text-[#687180]" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{title}</span>
                    <span className="block text-[13px] text-[#737C88]">{subtitle}</span>
                  </span>
                  <ChevronLeft className="rotate-180 text-[#737C88]" size={20} />
                  </button>
              )
            ))}
          </div>

          <div className="mt-2 overflow-hidden rounded-[21px] bg-[#E9EAED]">
            <a href="/account/profile" className="flex min-h-[54px] items-center gap-4 border-b border-[#D5D7DB] px-5">
              <Settings size={24} className="text-[#687180]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">Settings</span>
                <span className="block text-[13px] text-[#737C88]">Manage your account</span>
              </span>
              <ChevronLeft className="rotate-180 text-[#737C88]" size={20} />
            </a>
            <a href="/help" className="flex min-h-[54px] items-center gap-4 px-5">
              <Headphones size={24} className="text-[#687180]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">{t("menu.support")} 24/7</span>
                <span className="block text-[13px] text-[#737C88]">Get help anytime</span>
              </span>
              <ChevronLeft className="rotate-180 text-[#737C88]" size={20} />
            </a>
          </div>
          <button type="button" onClick={() => void logout()} disabled={loggingOut} className="mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[21px] bg-[#FDECEF] text-[16px] font-bold text-[#C6283D] disabled:opacity-50">
            <LogIn className="rotate-180" size={22} />
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function MobileTabBar() {
  const { t, session } = useApp();
  const pathname = usePathname();
  const openFromControl = useBetSlip((s) => s.openFromControl);
  const count = useBetSlip((s) => s.items.length);
  useEffect(() => { void useBetSlip.persist.rehydrate(); }, []);
  return (
    <nav className="fixed bottom-0 z-40 w-full border-t border-white/[0.08] bg-[#111111] text-white shadow-[0_-8px_28px_rgba(0,0,0,.38)] backdrop-blur lg:hidden safe-bottom" aria-label="bottom">
      <div className="grid grid-cols-4">
        {[
          { href: '/', icon: Home, label: t('nav.home') },
          { href: '/live', icon: Radio, label: t('nav.live') },
          { href: '/bets', icon: Ticket, label: t('nav.myBets') },
          { href: '/wallet', icon: WalletCards, label: t('nav.wallet') },
        ].map((item) => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${pathname === item.href ? 'text-nova-primary' : 'text-[#9CA3AF] hover:text-white'}`}>
            <span className="grid h-[22px] w-[22px] place-items-center" aria-hidden>{item.href === "/" ? <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="currentColor"><path d="M3 10.7 12 3l9 7.7v8.1c0 .9-.7 1.7-1.7 1.7H4.7c-.9 0-1.7-.8-1.7-1.7v-8.1Z"/><path d="M9 20.5v-6h6v6" fill="none" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/></svg> : item.href === "/live" ? <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none"><circle cx="12" cy="12" r="2.3" fill="currentColor"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> : item.href === "/bets" ? <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="currentColor"><path d="M4 6.5h16v11H4z"/><path d="M7 9.5h10M7 13h6M4 9.2c1.3 0 2-.9 2-2.7M20 9.2c-1.3 0-2-.9-2-2.7M4 14.8c1.3 0 2 .9 2 2.7M20 14.8c-1.3 0-2 .9-2 2.7" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/></svg> : <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="currentColor"><rect x="3.2" y="5.2" width="17.6" height="14" rx="2.2"/><path d="M3.5 9h17M15.2 13h3.1v2.6h-3.1a1.3 1.3 0 0 1 0-2.6Z" fill="none" stroke="#111" strokeWidth="1.6"/></svg>}</span>{item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Footer({
  onSupportOpen
}: { onSupportOpen?: () => void }) {
  const { t } = useApp();
  const pathname = usePathname();

  const featuredTeams = [
    { logo: 'manchester-united', name: 'Manchester United' },
    { logo: 'liverpool', name: 'Liverpool' },
    { logo: 'arsenal', name: 'Arsenal' },
    { logo: 'ac-milan', name: 'AC Milan' },
  ];
  const paymentMarks = [
    { logo: 'visa', name: 'Visa' },
    { logo: 'mastercard', name: 'Mastercard' },
    { logo: 'tether', name: 'Tether' },
    { logo: 'bitcoin', name: 'Bitcoin' },
    { logo: 'tron', name: 'TRON' },
  ];

  return (
    <footer
      aria-label="BetVima site footer"
      className={(pathname === '/' ? 'mt-3' : 'mt-6') + ' relative isolate overflow-hidden border-t border-[#22302E] bg-[#090F18] pb-36 text-white md:pb-8'}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-44 -top-48 h-[420px] w-[420px] rounded-full bg-[#00D47A]/[0.055] blur-[100px] md:h-[600px] md:w-[600px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 -left-48 h-[480px] w-[480px] rounded-full bg-[#087FF5]/[0.065] blur-[110px]"
      />
      <div className="nova-container relative">
        <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-[#00D47A]/70 to-transparent" />

        <div className="grid gap-8 py-9 sm:py-11 lg:grid-cols-12 lg:gap-12 lg:py-14">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/"
                aria-label="BetVima home"
                className="inline-flex shrink-0 items-center transition-opacity hover:opacity-85"
              >
                <img
                  src="/brand/betvima-wordmark.svg"
                  alt="BetVima"
                  className="h-auto w-[142px] object-contain sm:w-[165px]"
                />
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#00D47A]/25 bg-[#00D47A]/[0.07] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#75EABA]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#00D47A]" />
                Sportsbook &amp; Live
              </span>
            </div>

            <h2 className="mt-7 max-w-[620px] text-[34px] font-black leading-[1.11] tracking-[-0.045em] text-white sm:text-[44px] lg:text-[52px]">
              Every match.
              <span className="block text-[#00D47A]">One destination.</span>
            </h2>
            <p className="mt-4 max-w-[500px] text-[13px] font-medium leading-7 text-[#9CA9B9] sm:text-sm">
              Stay close to the action with live fixtures, football markets and
              everything you need in one place.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/sports/football"
                className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-[#00D47A] px-5 text-[13px] font-extrabold text-[#05170E] shadow-[0_12px_32px_rgba(0,212,122,.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#12E68B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00D47A]"
              >
                Explore football
                <Trophy aria-hidden="true" className="h-4 w-4 transition-transform group-hover:scale-110" />
              </Link>
              <Link
                href="/live"
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-white/[0.15] bg-white/[0.055] px-5 text-[13px] font-bold text-white transition duration-200 hover:border-white/35 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <Radio aria-hidden="true" className="h-4 w-4 text-[#00D47A]" />
                Live matches
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative flex h-full min-h-[290px] flex-col justify-between overflow-hidden rounded-[26px] border border-[#2A4B43] bg-gradient-to-br from-[#14372E] via-[#102D2B] to-[#102439] p-6 shadow-[0_24px_65px_rgba(0,0,0,.16)] sm:p-7">
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full border border-[#72E9B0]/[0.14]" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-[#72E9B0]/[0.08]" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#65E5A8]/20 bg-[#00D47A]/[0.13] text-[#80E8B3]">
                    <Headphones aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#64E9AB]/20 bg-[#00D47A]/[0.10] px-3 py-1.5 text-[11px] font-extrabold text-[#90EFC1]">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#00D47A]" />
                    24/7 Support
                  </span>
                </div>
                <h3 className="mt-7 text-[25px] font-black tracking-tight text-white sm:text-[29px]">
                  Here when you need us.
                </h3>
                <p className="mt-2 max-w-[315px] text-[13px] leading-6 text-[#B1C6C5]">
                  Questions about your account or a transaction? Reach our support team directly.
                </p>
              </div>
              <button
                type="button"
                onClick={onSupportOpen}
                disabled={!onSupportOpen}
                className="relative mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-[13px] font-extrabold text-[#0D2B25] transition duration-200 hover:bg-[#DCFFEB] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" className="h-[17px] w-[17px]" />
                Contact support
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-9 border-y border-white/[0.09] py-9 sm:grid-cols-2 sm:py-10 lg:grid-cols-4 lg:gap-x-10">
          <nav aria-label="Explore BetVima">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.20em] text-[#78E9AF]">Explore</h3>
            <ul className="mt-5 space-y-3.5 text-[13px] font-semibold text-[#A6B2C1]">
              <li><Link href="/" className="transition-colors hover:text-white focus-visible:text-white">{t('nav.home')}</Link></li>
              <li><Link href="/live" className="transition-colors hover:text-white focus-visible:text-white">{t('nav.live')}</Link></li>
              <li><Link href="/sports/football" className="transition-colors hover:text-white focus-visible:text-white">Football</Link></li>
            </ul>
          </nav>

          <nav aria-label="Account and partners">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.20em] text-[#78E9AF]">Account &amp; partners</h3>
            <ul className="mt-5 space-y-3.5 text-[13px] font-semibold text-[#A6B2C1]">
              <li><Link href="/bets" className="transition-colors hover:text-white focus-visible:text-white">{t('nav.myBets')}</Link></li>
              <li><Link href="/wallet" className="transition-colors hover:text-white focus-visible:text-white">{t('nav.wallet')}</Link></li>
              <li><Link href="/affiliate/login" className="transition-colors hover:text-white focus-visible:text-white">Partner program</Link></li>
            </ul>
          </nav>

          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.20em] text-[#78E9AF]">Get in touch</h3>
            <div className="mt-5 space-y-4">
              <a href="mailto:BetVimaSupport@gmail.com" className="group block">
                <span className="block text-[11px] font-medium text-[#75879A]">Customer support</span>
                <span className="mt-1 block break-all text-[12px] font-semibold text-[#D7E3EB] transition-colors group-hover:text-[#00D47A]">BetVimaSupport@gmail.com</span>
              </a>
              <a href="mailto:VimaPartner@gmail.com" className="group block">
                <span className="block text-[11px] font-medium text-[#75879A]">Partnerships</span>
                <span className="mt-1 block break-all text-[12px] font-semibold text-[#D7E3EB] transition-colors group-hover:text-[#00D47A]">VimaPartner@gmail.com</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.20em] text-[#78E9AF]">Preferences</h3>
            <div className="mt-4">
              <LanguageSelector variant="footer" />
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.16] text-[12px] font-black text-white">18+</span>
              <div>
                <p className="text-[12px] font-bold text-[#E6EBF2]">Play responsibly</p>
                <p className="mt-1 text-[11px] leading-5 text-[#8D9BAA]">Betting is for adults only.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 py-6 sm:py-7 lg:grid-cols-2 lg:gap-6">
          <section aria-label="Featured football clubs" className="rounded-2xl border border-white/[0.08] bg-[#111B29]/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <Trophy aria-hidden="true" className="h-[16px] w-[16px] text-[#00D47A]" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D4DFE8]">Featured clubs</h3>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {featuredTeams.map((team) => (
                <div
                  key={team.logo}
                  title={team.name}
                  className="flex h-[58px] min-w-[66px] flex-1 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 sm:min-w-[72px]"
                >
                  <img
                    src={'/brand/footer/teams/' + team.logo + '.svg'}
                    alt={team.name}
                    loading="lazy"
                    className="h-9 w-9 object-contain"
                  />
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Payment methods" className="rounded-2xl border border-white/[0.08] bg-[#111B29]/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <WalletCards aria-hidden="true" className="h-[16px] w-[16px] text-[#00D47A]" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D4DFE8]">Payment methods</h3>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {paymentMarks.map((method) => (
                <div
                  key={method.logo}
                  title={method.name}
                  className="flex h-[58px] min-w-[77px] flex-1 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5"
                >
                  <img
                    src={'/brand/footer/payments/' + method.logo + '.svg'}
                    alt={method.name}
                    loading="lazy"
                    className="h-7 w-auto max-w-[66px] object-contain"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/[0.09] py-5 text-[11px] font-medium text-[#8795A6] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BetVima. All rights reserved.</p>
          <div className="flex items-center justify-between gap-5 sm:justify-end">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#76D9A8]" />
              Play safe. Stay in control.
            </span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Back to top"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-white transition hover:border-[#00D47A]/50 hover:bg-[#00D47A]/[0.12] hover:text-[#00D47A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D47A]"
            >
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}


function SupportSheet({
  close
}: { close: () => void }) {
  const { t } = useApp();
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpening(false), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(close, 320);
  }, [closing, close]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("menu.support")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <button
        type="button"
        className={`absolute inset-0 h-full w-full bg-black/75 backdrop-blur-sm transition-opacity duration-500 ease-out ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        aria-label={t("common.close")}
        onClick={requestClose}
      />
      <section
        className={`relative z-10 flex h-[88vh] max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#080D18] shadow-[0_-18px_60px_rgba(0,0,0,.55)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-[90vh] sm:max-h-[90vh] sm:max-w-[720px] ${
          closing ? "translate-y-full" : opening ? "translate-y-full" : "translate-y-0"
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0B1118] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#303136] text-white">
              <Headphones size={20} />
            </span>
            <div>
              <p className="text-sm font-black text-white">{t("menu.support")}</p>
              <p className="mt-0.5 text-xs text-slate-500">24/7 Live Chat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#20252A] text-white transition duration-200 hover:bg-[#2B3036] active:scale-90"
            aria-label={t("common.close")}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <SupportClient />
        </div>
      </section>
    </div>
  );
}

export function PageShell({ children, title, subtitle, titleKey, subtitleKey, actions }: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
  actions?: React.ReactNode;
}) {
  const isHome = title === undefined && subtitle === undefined && titleKey === undefined && subtitleKey === undefined && actions === undefined;
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const routes = ['/','/live','/bets','/wallet','/sports/football'];
    let cancelled = false;
    const prefetch = async () => {
      for (const href of routes) {
        if (cancelled) break;
        router.prefetch(href);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    };
    const timer = window.setTimeout(prefetch, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);
  const { t, session } = useApp();
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const [homeProfileSheetOpen, setHomeProfileSheetOpen] = useState(false);
  const [supportSheetOpen, setSupportSheetOpen] = useState(false);
  const [authSheetMode, setAuthSheetMode] = useState<'login' | 'register' | null>(null);
  useEffect(() => { if (!isHome) return; const openProfile = () => setHomeProfileSheetOpen(true); window.addEventListener("nova:open-profile-sheet", openProfile); return () => window.removeEventListener("nova:open-profile-sheet", openProfile); }, [isHome]);
  useEffect(() => {
    const onSupportClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href="/support"]');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      setSupportSheetOpen(true);
    };
    document.addEventListener("click", onSupportClick, true);
    return () => document.removeEventListener("click", onSupportClick, true);
  }, []);

  useEffect(() => {
    if (!supportSheetOpen) return;
    const y = window.scrollY;
    const body = document.body;
    body.dataset.novaSupportScrollY = String(y);
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      const saved = Number(body.dataset.novaSupportScrollY || "0");
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      delete body.dataset.novaSupportScrollY;
      window.scrollTo(0, saved);
    };
  }, [supportSheetOpen]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('auth');
    if (requested === 'login' || requested === 'register') {
      setAuthSheetMode(requested);
      window.history.replaceState(null, '', window.location.pathname);
    }
    const openAuth = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: 'login' | 'register' }>).detail?.mode;
      if (mode === 'login' || mode === 'register') setAuthSheetMode(mode);
    };
    window.addEventListener('nova:open-auth-sheet', openAuth);
    return () => window.removeEventListener('nova:open-auth-sheet', openAuth);
  }, []);
  useEffect(() => {
    if (!isHome) return;
    document.body.dataset.novaHomeMenu = homeMenuOpen ? "1" : "0";
    document.body.dataset.novaHomeProfile = homeProfileSheetOpen ? "1" : "0";
    return () => {
      delete document.body.dataset.novaHomeMenu;
      delete document.body.dataset.novaHomeProfile;
    };
  }, [isHome, homeMenuOpen, homeProfileSheetOpen]);

  return (
    <>
    <div className={`min-h-dvh pb-0 md:pb-0 ${pathname === "/bonuses" ? "bg-[#030A12]" : ""}`}>
      {isHome ? (
        <>
          <HomeHeader onMenu={() => setHomeMenuOpen(true)} />
          {homeProfileSheetOpen ? <MobileProfileSheet close={() => setHomeProfileSheetOpen(false)} /> : null}
          {homeMenuOpen ? (
            <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
              <button
                type="button"
                className="absolute inset-0 h-full w-full bg-black/80 backdrop-blur-sm animate-[novaFadeIn_.18s_ease-out]"
                aria-label={t("common.close")}
                onClick={() => setHomeMenuOpen(false)}
              />
              <ReferenceMobileDrawer
                close={() => setHomeMenuOpen(false)}
                onSupportOpen={() => setSupportSheetOpen(true)}
              />
            </div>
          ) : null}
        </>
      ) : <Header onSupportOpen={() => setSupportSheetOpen(true)} />}
          <Suspense fallback={null}><ReferenceSportsNav showTournament={pathname === '/'} showSportsCarousel={pathname === '/live'} /></Suspense>
      <PullToRefresh />
          <main className={`nova-container py-4 ${pathname === "/" || pathname === "/bonuses" ? "pb-0" : "pb-24 lg:pb-4"}`}>
        {(title || titleKey) ? (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{titleKey ? t(titleKey) : title}</h1>
              {(subtitle || subtitleKey) ? <p className="mt-1 text-sm nova-muted">{subtitleKey ? t(subtitleKey) : subtitle}</p> : null}
            </div>
            {actions}
          </div>
        ) : null}
        {children}
      </main>
      <div className={pathname === "/bonuses" ? "mt-0" : ""}>
        <Footer onSupportOpen={() => setSupportSheetOpen(true)} />
      </div>
      <MobileTabBar />
      
    </div>
    <BetSlipRail />
    {authSheetMode ? (
      <AuthSheet
        mode={authSheetMode}
        onClose={() => setAuthSheetMode(null)}
      />
    ) : null}
    {supportSheetOpen ? (
      <SupportSheet close={() => setSupportSheetOpen(false)} />
    ) : null}
    </>
  );
}
