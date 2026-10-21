import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { OriginalsDemo } from '@/components/casino/originals-demo';

export const dynamic = 'force-dynamic';

export default function CasinoOriginalsPage() {
  // Off by default: an explicitly enabled preview is not a real-money launch.
  if (process.env.BETVIMA_ORIGINALS_PREVIEW_ENABLED !== 'true') notFound();

  return (
    <PageShell title="BetVima Originals" subtitle="Play-for-fun technical preview">
      <OriginalsDemo />
    </PageShell>
  );
}
