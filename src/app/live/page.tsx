import { PageShell } from '@/components/layout/page-shell';
import { BetsApiFixtures } from '@/components/betsapi/betsapi-fixtures';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live | BetVima' };
export default async function LivePage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const { sport } = await searchParams;
  return <PageShell><BetsApiFixtures mode="live" initialSport={sport ?? 'football'} /></PageShell>;
}
