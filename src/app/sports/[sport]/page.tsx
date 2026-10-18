import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { BetsApiFixtures } from '@/components/betsapi/betsapi-fixtures';
import { sportByKey } from '@/lib/betsapi-sports-map';
export const dynamic = 'force-dynamic';
export default async function SportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!sportByKey(sport)) notFound();
  return <PageShell><BetsApiFixtures mode="upcoming" initialSport={sport} /></PageShell>;
}
