'use client';

import Link from 'next/link';
import { WalletCards } from 'lucide-react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatMinor } from '@/lib/i18n';
import { useApp } from './providers';

type WalletResponse = {
  wallet?: {
    currency?: string;
    balanceMinor?: string | number;
    heldMinor?: string | number;
    availableMinor?: string | number;
  } | null;
};

export function TopWalletBalance() {
  const { locale, session } = useApp();
  const currency = session?.user?.currency || 'IRR';

  const { data, loading } = useApiQuery<WalletResponse>(
    session?.authenticated
      ? `/api/v1/wallet?currency=${encodeURIComponent(currency)}`
      : '',
    { pollMs: 30_000 },
  );

  if (!session?.authenticated) return null;

  const walletCurrency = data?.wallet?.currency || currency;
  const balanceMinor = data?.wallet?.balanceMinor ?? '0';
  const availableMinor = data?.wallet?.availableMinor ?? '0';
  const heldMinor = data?.wallet?.heldMinor ?? '0';

  let balance = '—';

  if (!loading) {
    try {
      balance = formatMinor(BigInt(availableMinor), walletCurrency as never, locale);
    } catch {
      balance = '—';
    }
  }

  return (
    <Link
      href="/wallet"
      className="flex h-10 items-center gap-1.5 rounded-xl border border-[#303030] bg-[#1B1B1B] px-2 transition hover:bg-[#252525] sm:h-11 sm:gap-2 sm:px-3"
      aria-label="Account balance"
    >
      <WalletCards size={17} strokeWidth={1.8} className="text-nova-primary" />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#858585]">
          Balance
        </span>
        <span
          data-testid="top-wallet-balance"
          className="mt-1 whitespace-nowrap text-[12px] font-extrabold text-white"
        >
          {balance}
        </span>
      </span>
    </Link>
  );
}
