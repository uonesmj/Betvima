'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/components/layout/providers';

export function MatchBackButton() {
  const { t, dir } = useApp();
  return (
    <Link
      href="/sports/football"
      dir={dir}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDE1E6] bg-white px-3 py-2 text-xs font-bold text-[#4E5660] transition hover:bg-[#F5F6F8]"
    >
      <ArrowLeft size={14} />
      {t('common.back')}
    </Link>
  );
}

export function MatchMarketsHeader({ count }: { count: number }) {
  const { t, dir } = useApp();
  return (
    <div dir={dir} className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-[#20242A]">
          {t('match.bettingMarkets')}
        </h2>
        <p className="mt-1 text-xs text-[#858C95]">
          {t('match.selectOdd')}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#EEF0F3] px-3 py-1.5 text-[10px] font-bold text-[#69717A]">
        {count} {t('match.markets')}
      </span>
    </div>
  );
}

export function MatchMobileHelper() {
  const { t, dir } = useApp();
  return (
    <div dir={dir} className="rounded-2xl border border-[#DDE1E6] bg-[#F7F8F9] px-4 py-3 text-center text-[10px] text-[#858C95] md:hidden">
      {t('match.mobileHelper')}
    </div>
  );
}
