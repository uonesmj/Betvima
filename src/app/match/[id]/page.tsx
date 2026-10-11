import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { ServiceNotice } from '@/components/layout/service-notice';
import { MarketList } from '@/components/betting/market-list';
import { LiveMatchCenterClient } from '@/components/betting/live-match-center-client';
import { getMatchPageData } from '@/server/queries/public';
import { formatRelative } from '@/lib/i18n';
import { MatchBackButton, MatchMarketsHeader, MatchMobileHelper } from '@/components/betting/match-page-copy';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Match — NOVA',
    description: 'Betting markets and odds',
  };
}
export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMatchPageData(id);

  if (!data) notFound();

  const { match, markets, result, liveEvents, liveStats, liveBettingEnabled, matchHistory } = data;

  const matchForDisplay =
    match.isLive && !liveBettingEnabled
      ? { ...match, isBettingAvailable: false }
      : match;

  const home = match.participants.find((p) => p.role === 'HOME');
  const away = match.participants.find((p) => p.role === 'AWAY');

  const homeName = home?.name ?? 'TBD';
  const awayName = away?.name ?? 'TBD';

  return (
    <PageShell
      title={`${homeName} vs ${awayName}`}
      subtitle=""
      actions={
        <Link
          href="/sports/football"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDE1E6] bg-white px-3 py-2 text-xs font-bold text-[#4E5660] transition hover:bg-[#F5F6F8]"
        >
        </Link>
      }
    >
      <div className="mx-auto max-w-[1120px] space-y-4">
        {match.isLive && !liveBettingEnabled ? (
          <ServiceNotice tone="warning" titleKey="page.liveBettingUnavailable" childrenKey="page.liveBettingUnavailableDetail" />
        ) : null}

        {/* Match hero + swipeable information */}
        <LiveMatchCenterClient
          matchId={match.id}
          initialMinute={match.minute}
          initialPeriod={match.period}
          initialEvents={liveEvents}
          initialStats={liveStats}
          match={match}
          matchForDisplay={matchForDisplay}
          home={home}
          away={away}
          homeName={homeName}
          awayName={awayName}
          liveEvents={liveEvents}
          liveStats={liveStats}
          matchHistory={matchHistory}
        />
        <section>

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#20242A]">
                Betting markets
              </h2>

              <p className="mt-1 text-xs text-[#858C95]">
                Select an odd to add it to your bet slip
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-[#EEF0F3] px-3 py-1.5 text-[10px] font-bold text-[#69717A]">
              {markets.length} markets
            </span>
          </div>

          <MarketList
            match={matchForDisplay}
            markets={markets}
          />

        </section>

        {/* Mobile helper */}
<MatchMobileHelper />

      </div>
    </PageShell>
  );
}
