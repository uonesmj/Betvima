import { Flame } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { ServiceNotice } from '@/components/layout/service-notice';
import { TopBetCard } from '@/components/betting/top-bet-card';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { serializeMatch } from '@/server/queries/public';
import { readLiveBettingEnabled } from '@/server/live-betting';

export const dynamic = 'force-dynamic';


export default async function TopBetsPage() {
  const services = createServices();
  const [matches, liveEnabled] = await Promise.all([
    services.catalog.listTopBetMatches(serviceRoleContext, 168, 30),
    readLiveBettingEnabled(services.admin),
  ]);
  const topBets = matches;
  return (
    <PageShell title='Top Bets' subtitle='Popular upcoming events'>
      {!liveEnabled ? <ServiceNotice tone="warning" titleKey="page.liveBettingUnavailable" childrenKey="page.liveBettingUnavailableDetail" /> : null}
      {topBets.length ? <div className='grid gap-3 lg:grid-cols-2'>{topBets.map((match) => <TopBetCard key={match.id} match={serializeMatch(match)} liveEnabled={liveEnabled} />)}</div> : <div className='nova-card p-8 text-center'><Flame className='mx-auto mb-3' size={28} /><p className='text-sm font-bold text-[#252A31]'>No top bets available yet.</p></div>}
    </PageShell>
  );
}
