import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { CasinoCatalogueClient } from '@/components/casino/casino-showcase';

export const dynamic = 'force-dynamic';

export default function CasinoPage() {
  return (
    <PageShell title="Casino" subtitle="Slots and live casino games">
      <Link href="/casino/originals"
        className="mb-4 flex items-center justify-between rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-[#17253E] to-[#0D2833] px-5 py-4 text-white shadow-lg hover:border-cyan-400/70">
        <span className="min-w-0">
          <span className="block text-xs font-extrabold uppercase tracking-widest text-cyan-300">BETVIMA ORIGINALS</span>
          <span className="mt-1 block text-sm font-bold sm:text-base">Crash · Roulette · Slots</span>
          <span className="mt-1 block text-xs text-slate-300">Independent demo games · No real money</span>
        </span>
        <span aria-hidden="true" className="ms-4 text-2xl font-bold text-cyan-300">→</span>
      </Link>
      <CasinoCatalogueClient />
    </PageShell>
  );
}
