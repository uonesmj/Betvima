import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { PrematchFilters } from '@/components/betting/prematch-filters';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { serializeMatch } from '@/server/queries/public';
import { rankUpcomingMatches } from '@/lib/upcoming-ranking';

export const dynamic = 'force-dynamic';

export default async function SportPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const services = createServices();

  const sports = await services.catalog.listSports(serviceRoleContext);
  const current = sports.find((s) => s.key === sport);

  if (!current) notFound();

  const [leagues, matches, liveMatches, operations] = await Promise.all([
    services.catalog.listLeagues(serviceRoleContext, {
      sportKey: sport,
      limit: 200,
    }),
    services.catalog.listMatches(serviceRoleContext, {
      sportKey: sport,
      page: 1,
      pageSize: sport === 'esports' ? 500 : 100,
      status: sport === 'esports' ? ['scheduled', 'live'] : ['scheduled'],
      from: sport === 'esports'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString(),
      includeTotal: false,
    }),
    sport === 'esports'
      ? services.catalog.listMatches(serviceRoleContext, {
          sportKey: 'esports',
          page: 1,
          pageSize: 500,
          status: ['live'],
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          includeTotal: false,
        })
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0, hasMore: false }),
    services.admin.operations(),
  ]);

  const liveBettingEnabled =
    operations.find((operation) => operation.key === 'LIVE_BETTING')?.isEnabled ?? true;

  const serializedMatches =
    sport === 'esports'
      ? [
          ...liveMatches.items,
          ...rankUpcomingMatches(
            matches.items.filter(
              (match) =>
                match.status !== 'live' &&
                !liveMatches.items.some((live) => live.id === match.id),
            ),
          ),
        ].map(serializeMatch)
      : rankUpcomingMatches(matches.items).slice(0, 30).map(serializeMatch);

  return (
    <PageShell>
      <PrematchFilters
        items={serializedMatches}
        liveEnabled={liveBettingEnabled}
        leagues={leagues}
        sportKey={sport}
      />
    </PageShell>
  );
}
