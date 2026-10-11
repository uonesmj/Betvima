import type { ReactNode } from 'react';
import Link from 'next/link';
import { AffiliateNav } from '@/components/account/affiliate-nav';

export default function AffiliateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="affiliate-shell min-h-screen bg-[#EEF2F6] text-[#172033]">
      <header className="affiliate-header sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[66px] max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/affiliate/dashboard" className="group flex shrink-0 items-center gap-3">
            <div className="flex h-10 items-center rounded-xl border border-[#E5ECF3] bg-white px-3 shadow-sm transition group-hover:border-[#CFE4F8]">
              <img
                src="/brand/betvima-logo-transparent.png"
                alt="BetVima Affiliate"
                className="h-auto w-[112px] object-contain sm:w-[124px]"
              />
            </div>
            <div className="hidden border-l border-[#E5EAF0] pl-3 sm:block">
              <div className="text-[9px] font-black uppercase tracking-[.22em] text-[#087FF5]">PARTNER</div>
              <div className="text-xs font-bold text-[#64748B]">Affiliate Center</div>
            </div>
          </Link>
          <AffiliateNav />
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-66px)] max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        {children}
      </main>
    </div>
  );
}
