import Link from 'next/link';
import { Activity, ArrowLeft, CircleDot, Dumbbell, Gamepad2, Swords, Target, Trophy, Zap } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { HomeReference } from '@/components/home/home-reference';
import { ServiceNotice } from '@/components/layout/service-notice';
import { MatchListClient } from '@/components/betting/match-list-client';
import { getHomepageData, getServiceAvailability } from '@/server/queries/public';

export const dynamic = 'force-dynamic';
const SPORT_ICONS = { football: Trophy, basketball: CircleDot, tennis: Target, volleyball: Activity, 'ice-hockey': Zap, handball: Dumbbell, baseball: CircleDot, 'american-football': Trophy, cricket: Activity, mma: Swords, boxing: Dumbbell, 'table-tennis': Target, esports: Gamepad2 } as const;

export default async function HomePage() {
  const [data, availability] = await Promise.all([getHomepageData(), getServiceAvailability()]);
  const liveEnabled = availability.liveBettingEnabled;
  const maintenance = availability.operations.find((o) => o.key === 'MAINTENANCE_MODE')?.isEnabled ?? false;

  return (
    <PageShell
    >
      {maintenance ? (
        <ServiceNotice tone="danger" titleKey="page.maintenance" childrenKey="page.maintenanceDetail" />
      ) : null}
      {!availability.sportsConfigured ? (
        <ServiceNotice tone="warning" titleKey="page.oddsUnavailable" childrenKey="page.oddsUnavailableDetail" />
      ) : null}
      {!liveEnabled ? (
        <ServiceNotice tone="warning" titleKey="page.liveBettingUnavailable" childrenKey="page.liveBettingUnavailableDetail" />
      ) : null}
      <div dir="ltr" className="w-full">
        <HomeReference
          sports={data.sports}
          live={data.live}
          upcoming={data.upcoming}
          topBets={data.topBets}
          topBetsUnavailable={data.degraded.includes('topBets')}
          liveEnabled={liveEnabled}
        />
      </div>
    </PageShell>
  );
}
