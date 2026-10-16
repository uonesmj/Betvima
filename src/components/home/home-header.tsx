'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, UserRound, UserPlus } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { TopWalletBalance } from '@/components/layout/top-wallet-balance';
import { NotificationsBell } from '@/components/layout/notifications-bell';
const NAV = [
  ['Top', '/'],
  ['Live', '/live'],
  ['Upcoming', '/sports/football'],
  ['Top Bets', '/sports/football'],
  ['Esports', '/sports/esports'],
  ['Bet History', '/bets'],
 ] as const;

export function HomeHeader({ onMenu }: { onMenu?: () => void }) {
  const { session, sessionLoading, t } = useApp();

  return (
    <>
      <header dir="ltr" className="border-b border-[#252525] bg-[#111111] text-white">
        <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-3 px-3 sm:px-5 lg:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center">
            <img
              src="/brand/betvima-logo-transparent.png"
              alt="BetVima"
              className="h-auto w-[72px] sm:w-[105px] object-contain shrink-0"
            />
          </Link>

          <Link href="/casino" className="hidden rounded-xl border border-[#bf985650] bg-[#2a251c] px-4 py-2.5 text-xs font-black tracking-[.08em] text-[#f8d594] transition hover:border-[#f8d594] hover:bg-[#3e3022] lg:inline-flex">CASINO</Link>

          <div className="ml-auto flex items-center gap-2">
            {sessionLoading ? (
              <div className="flex items-center gap-2" aria-hidden="true">
                <div className="h-10 w-[92px] animate-pulse rounded-xl bg-[#20242A] sm:h-11 sm:w-[118px]" />
                <div className="h-10 w-[96px] animate-pulse rounded-xl bg-[#20242A] sm:h-11 sm:w-[128px]" />
              </div>
            ) : session?.authenticated ? (
              <>
                <TopWalletBalance />
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("nova:open-profile-sheet"))} className="hidden rounded-lg bg-[#272727] px-4 py-2 text-sm font-bold transition hover:bg-[#333333] sm:block"
                >
                  {session.user?.email?.split('@')[0] || t('nav.account')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('nova:open-auth-sheet', { detail: { mode: 'login' } }))}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#20242A] px-3.5 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition-all duration-200 hover:bg-[#292E35] hover:-translate-y-px active:translate-y-0 sm:h-11 sm:gap-2 sm:px-5 sm:text-sm"
                >
                  <UserRound className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" strokeWidth={2} />
                  <span>{t('nav.login')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('nova:open-auth-sheet', { detail: { mode: 'register' } }))}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-nova-primary px-3.5 text-xs font-black text-[#04140C] shadow-[0_5px_18px_rgba(0,230,118,.16)] transition-all duration-200 hover:brightness-105 hover:-translate-y-px hover:shadow-[0_7px_22px_rgba(0,230,118,.22)] active:translate-y-0 sm:h-11 sm:gap-2 sm:px-5 sm:text-sm"
                >
                  <UserPlus className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" strokeWidth={2.2} />
                  <span>{t('nav.register')}</span>
                </button>
              </>
            )}


            <div className="shrink-0"><NotificationsBell /></div>
            <button
              type="button"
              onClick={onMenu}
              className="grid h-10 w-10 place-items-center rounded-lg bg-[#272727] lg:hidden"
              aria-label={t('nav.menu')}
            >
              <Menu size={21} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>
</>
  );
}
