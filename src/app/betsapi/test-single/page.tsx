import { PageShell } from '@/components/layout/page-shell';
import { BetsApiSingleBetTest } from '@/components/betsapi/betsapi-single-bet-test';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Single BetsAPI bet test | BetVima' };

export default function SingleBetsApiTestPage() {
  return <PageShell><BetsApiSingleBetTest /></PageShell>;
}
