import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { PrematchFilters } from '@/components/betting/prematch-filters';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { serializeMatch } from '@/server/queries/public';

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

  const [leagues, matches, operations] = await Promise.all([
    services.catalog.listLeagues(serviceRoleContext, {
      sportKey: sport,
      limit: 200,
    }),
    services.catalog.listMatches(serviceRoleContext, {
      sportKey: sport,
      leagueId,
      page: 1,
      pageSize: 50,
      status: ['scheduled'],
      from: new Date().toISOString(),
    }),
    services.admin.operations(),
  ]);

  const league = leagues.find((item) => item.id === leagueId);
  if (!league) notFound();

  const liveBettingEnabled =
    operations.find((operation) => operation.key === 'LIVE_BETTING')?.isEnabled ?? true;

  const serializedMatches = matches.items.map(serializeMatch);

  return (
    <PageShell>
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
