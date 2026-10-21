import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { OriginalsDemo } from '@/components/casino/originals-demo';
import { royalVaultOwnerDemoAccess } from '@/server/originals/owner-preview-access';

export const dynamic = 'force-dynamic';

export default async function CasinoOriginalsPage() {
  if (!await royalVaultOwnerDemoAccess()) notFound();

  return (
    <PageShell title="BetVima Originals" subtitle="Play-for-fun technical preview">
      <Link href="/casino/originals/royal-vault" className="mb-5 block overflow-hidden rounded-[20px] border border-[#B28A47] bg-[#081324] text-white shadow-[0_12px_35px_rgba(0,0,0,.22)] transition hover:border-[#F2D68F]">
        <Image src="/originals/royal-vault-hero.svg" alt="Royal Vault original slot illustration" width={1080} height={440} unoptimized className="h-auto max-h-[275px] w-full object-cover" />
        <span className="flex flex-wrap items-center justify-between gap-3 border-t border-[#B18C55] p-4">
          <span><strong className="block text-lg font-black text-[#F0D38E]">Royal Vault · 5 Reels</strong><span className="mt-1 block text-xs text-[#9BADC6]">Original five-payline slot · Demo credits only</span></span>
          <span className="rounded-xl bg-[#C79C4F] px-5 py-3 text-xs font-extrabold text-[#071220]">PLAY DEMO →</span>
        </span>
      </Link>
      <OriginalsDemo />
    </PageShell>
  );
}
