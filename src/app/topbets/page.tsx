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
    services.catalog.listUpcomingMatches(serviceRoleContext, 168, 50),
    readLiveBettingEnabled(services.admin),
  ]);
  const topBets = matches.filter((m) => m.sportKey.toLowerCase().includes('esport') === false).filter((m) => (m.topMarkets ?? []).some((market) => market.selections.length > 0)).sort((a, b) => (b.marketsCount ?? 0) - (a.marketsCount ?? 0)).slice(0, 30);
    console.log('[TOPBETS_QUALIFIED]', 'qualified=' + topBets.length, 'nonEsports=' + matches.filter((m) => m.sportKey.toLowerCase().includes('esport') === false).length);
  return (
    <PageShell title='Top Bets' subtitle='Popular upcoming events'>
      {!liveEnabled ? <ServiceNotice tone="warning" titleKey="page.liveBettingUnavailable" childrenKey="page.liveBettingUnavailableDetail" /> : null}
      {topBets.length ? <div className='grid gap-3 lg:grid-cols-2'>{topBets.map((match) => <TopBetCard key={match.id} match={serializeMatch(match)} liveEnabled={liveEnabled} />)}</div> : <div className='nova-card p-8 text-center'><Flame className='mx-auto mb-3' size={28} /><p className='text-sm font-bold text-[#252A31]'>No top bets available yet.</p></div>}
    </PageShell>
  );
}
