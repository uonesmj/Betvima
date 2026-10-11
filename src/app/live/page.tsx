import { PageShell } from '@/components/layout/page-shell';
import { ServiceNotice } from '@/components/layout/service-notice';
import { MatchListClient } from '@/components/betting/match-list-client';
import { LiveEmptyState } from '@/components/betting/live-empty-state';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { serializeMatch } from '@/server/queries/public';
import { readLiveBettingEnabled, readLiveCatalogue } from '@/server/live-betting';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live' };

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{
    league?: string;
    sport?: string;
    country?: string;
  }>;
}) {
  const { league: selectedLeague, sport: selectedSport } = await searchParams;
  const services = createServices();

  const [liveCatalogue, operationEnabled, providerConfigured] = await Promise.all([
    readLiveCatalogue(() => services.catalog.listLiveMatches(serviceRoleContext, 100), []),
    readLiveBettingEnabled(services.admin),
    Promise.resolve(services.providers.sports.configured),
  ]);
  const matches = liveCatalogue.value;
  const liveEnabled = operationEnabled && !liveCatalogue.unavailable;

  const visibleMatches = selectedLeague
    ? matches.filter((m) => m.leagueId === selectedLeague)
    : selectedSport
      ? matches.filter((m) => m.sportKey === selectedSport)
      : matches;

  return (
    <PageShell titleKey="live.title">
      <div className="space-y-4">
        {!providerConfigured ? (
          <ServiceNotice
            tone="warning"
            titleKey="page.noLiveProvider"
            childrenKey="page.noLiveProviderDetail"
          />
        ) : null}
        {!liveEnabled ? (
          <ServiceNotice tone="warning" titleKey="page.liveBettingUnavailable" childrenKey="page.liveBettingUnavailableDetail" />
        ) : null}
        {liveCatalogue.unavailable ? (
          <ServiceNotice tone="warning" titleKey="page.liveCatalogueUnavailable" childrenKey="page.liveCatalogueUnavailableDetail" />
        ) : null}

        {matches.length === 0 ? (
          <LiveEmptyState />
        ) : (
          <MatchListClient
            matches={visibleMatches.map(serializeMatch)}
            liveEnabled={liveEnabled}
            livePage
          />
        )}
      </div>
    </PageShell>
  );
}
