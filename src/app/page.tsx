import { PageShell } from '@/components/layout/page-shell';
import { HomeReference } from '@/components/home/home-reference';
import { getBetsApiHomepage } from '@/server/betsapi-feed';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';

export const dynamic = 'force-dynamic';

/** The home sports cards use only BetsAPI; old provider DB fixtures are never selected. */
export default async function HomePage() {
  const data = await getBetsApiHomepage();
  return <PageShell>
    {!data.configured || data.errors.length > 0 ? (
      <p role="alert" className="mx-3 my-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        BetsAPI {data.configured ? 'is temporarily unavailable for some sports. Numbers may be incomplete.' : 'is not configured for public catalogues.'}
      </p>
    ) : null}
    <div dir="ltr" className="w-full">
      <HomeReference
        sports={BETSAPI_SPORTS.map(s => ({ key: s.key, name: s.name }))}
        live={data.live}
        upcoming={data.upcoming}
        topBets={[]}
        topBetsUnavailable
        liveEnabled={false}
        liveTotal={data.liveTotal}
        upcomingTotal={data.upcomingTotal}
      />
    </div>
  </PageShell>;
}
