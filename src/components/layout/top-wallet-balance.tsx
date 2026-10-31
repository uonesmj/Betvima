'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WalletCards } from 'lucide-react';
import { formatMinor } from '@/lib/i18n';
import { useApp } from './providers';

type BalanceRow = {
  currency: string;
  balanceMinor: string;
  heldMinor: string;
  availableMinor: string;
  version: string;
};

function validatedBalance(row: BalanceRow | undefined): BalanceRow | null {
  if (!row || !['USD', 'IRR', 'IRT', 'USDT'].includes(row.currency)) return null;
  try {
    const balance = BigInt(row.balanceMinor);
    const held = BigInt(row.heldMinor);
    const available = BigInt(row.availableMinor);
    const version = BigInt(row.version);
    if (balance < 0n || held < 0n || available < 0n || version < 0n ||
      available !== (balance > held ? balance - held : 0n)) return null;
    return row;
  } catch {
    return null;
  }
}

export function TopWalletBalance() {
  const { locale, session } = useApp();
  const authenticated = session?.authenticated === true;
  const userId = authenticated ? session?.user?.id : undefined;
  const [snapshot, setSnapshot] = useState<BalanceRow | null>(null);
  const [snapshotUserId, setSnapshotUserId] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let lastVersion = -1n;
    const controller = new AbortController();
    setSnapshot(null);
    setSnapshotUserId(null);
    if (!authenticated || !userId) return () => controller.abort();

    const refresh = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const response = await fetch('/api/v1/wallet/balance', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store' },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json() as {
          ok?: boolean; data?: { wallet?: BalanceRow };
        };
        const row = payload.ok ? validatedBalance(payload.data?.wallet) : null;
        if (!row || stopped) return;
        const version = BigInt(row.version);
        if (version <= lastVersion) return;
        lastVersion = version;
        setSnapshot(row);
        setSnapshotUserId(userId);
      } catch {
        // Retain the last server-confirmed figure on transient errors.
      } finally {
        inFlight = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onFocus = () => { void refresh(); };
    // Read the canonical wallet at most twice per second while the page is visible.
    // The inFlight guard above prevents concurrent requests from accumulating.
    const timer = window.setInterval(() => { void refresh(); }, 500);
    window.addEventListener('focus', onFocus);
    window.addEventListener('nova:wallet-balance-changed', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    void refresh();
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('nova:wallet-balance-changed', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authenticated, userId]);

  if (!authenticated) return null;
  const wallet = snapshotUserId === userId ? snapshot : null;
  let balance = '—';
  if (wallet) {
    try {
      balance = formatMinor(BigInt(wallet.availableMinor), wallet.currency as never, locale);
    } catch {
      balance = '—';
    }
  }

  return (
    <Link href="/wallet"
      className="flex h-10 items-center gap-1.5 rounded-xl border border-[#303030] bg-[#1B1B1B] px-2 transition hover:bg-[#252525] sm:h-11 sm:gap-2 sm:px-3"
      aria-label="Account balance"
    >
      <WalletCards size={17} strokeWidth={1.8} className="text-nova-primary" />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#858585]">Balance</span>
        <span data-testid="top-wallet-balance"
          className="mt-1 whitespace-nowrap text-[12px] font-extrabold text-white">
          {balance}
        </span>
      </span>
    </Link>
  );
}
