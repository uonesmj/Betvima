import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { CasinoCatalogueClient } from '@/components/casino/casino-showcase';

export const dynamic = 'force-dynamic';

export default function CasinoPage() {
  return (
    <PageShell title="Casino" subtitle="Slots and live casino games">
      {process.env.BETVIMA_ORIGINALS_PREVIEW_ENABLED === 'true' ? (
        <Link href="/casino/originals" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#2E4B76] bg-[#0E192A] px-4 py-4 text-white transition hover:border-[#4698FF]">
          <span><strong className="block text-sm">BetVima Originals · Play-for-fun preview</strong><span className="mt-1 block text-xs text-[#A9C3E5]">Two experimental game engines · Six demo themes · No wallet connection</span></span>
          <span aria-hidden="true" className="shrink-0 text-xl text-[#81B6FF]">→</span>
        </Link>
      ) : null}
      <CasinoCatalogueClient />
    </PageShell>
  );
}
