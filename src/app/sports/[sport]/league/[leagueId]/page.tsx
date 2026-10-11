import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { ServiceNotice } from '@/components/layout/service-notice';
import { PrematchFilters } from '@/components/betting/prematch-filters';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { serializeMatch } from '@/server/queries/public';
import { readLiveBettingEnabled } from '@/server/live-betting';
import { readLeaguePageLeagues } from '@/server/queries/league-page';

export const dynamic = 'force-dynamic';

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ sport: string; leagueId: string }>;
}) {
  const { sport, leagueId } = await params;
  const services = createServices();

  const sports = await services.catalog.listSports(serviceRoleContext);
  const currentSport = sports.find((item) => item.key === sport);
  if (!currentSport) notFound();

  const [leagueCatalogue, matches, liveBettingEnabled] = await Promise.all([
    readLeaguePageLeagues(services.catalog, serviceRoleContext, sport, leagueId),
    services.catalog.listMatches(serviceRoleContext, {
      sportKey: sport,
      leagueId,
      page: 1,
      pageSize: 50,
      status: ['scheduled'],
      from: new Date().toISOString(),
    }),
    readLiveBettingEnabled(services.admin),
  ]);

  const { league, leagues } = leagueCatalogue;
  if (!league) notFound();

  const serializedMatches = matches.items.map(serializeMatch);

  return (
    <PageShell>
      {!liveBettingEnabled ? <ServiceNotice tone="warning" titleKey="page.liveBettingUnavailable" childrenKey="page.liveBettingUnavailableDetail" /> : null}
      <PrematchFilters
        items={serializedMatches}
        liveEnabled={liveBettingEnabled}
        leagues={leagues}
        sportKey={sport}
        leagueId={leagueId}
        initialPage={matches.page}
        initialPageSize={matches.pageSize}
        initialTotal={matches.total}
        initialHasMore={matches.hasMore}
      />
    </PageShell>
  );
}
