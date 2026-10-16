import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { FootballLivePreview } from '@/components/betting/football-live-preview';
import { DEMO_LIVE_FOOTBALL_FIXTURES } from '@/lib/football-live-demo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Football Live Research Preview',
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * Off in production, regardless of deployment environment variables.
 * Local-only read-only showcase. The normal /live route is unchanged.
 */
export default function FootballLiveResearchPage() {
  if (process.env.NODE_ENV === 'production' ||
      process.env.BETVIMA_FOOTBALL_PREVIEW !== 'true') notFound();
  return (
    <PageShell titleKey="live.title">
      <FootballLivePreview fixtures={DEMO_LIVE_FOOTBALL_FIXTURES} />
    </PageShell>
  );
}
