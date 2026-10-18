'use client';

import { useEffect, useState } from 'react';
import { HomeReference } from '@/components/home/home-reference';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';
import type { MatchView } from '@/components/betting/match-card';

interface HomeFeed {
  live: MatchView[];
  upcoming: MatchView[];
  liveTotal: number | null;
  upcomingTotal: number | null;
  errors: string[];
  configured: boolean;
}
const sports = BETSAPI_SPORTS.map(s => ({ key: s.key, name: s.name }));
const EMPTY: HomeFeed = { live: [], upcoming: [], liveTotal: null, upcomingTotal: null, errors: [], configured: true };
/**
 * Keep the home route responsive even when provider upstream calls are slow or
 * the trial quota is unavailable. The API endpoint owns shared upstream caching.
 */
export function BetsApiHomeReference() {
  const [feed, setFeed] = useState<HomeFeed>(EMPTY);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/v1/betsapi/catalogue?mode=home', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('BAD_RESPONSE');
        const body = await res.json();
        if (!body.ok || !body.data) throw new Error('INVALID_RESPONSE');
        if (active) { setFeed(body.data as HomeFeed); setFailed(false); }
      } catch {
        if (active) setFailed(true);
      } finally { if (active) setLoading(false); }
    };
    void load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, []);
  return <div dir="ltr" className="w-full">
    {loading && <p className="mx-3 my-2 rounded-lg bg-[#EAF3FF] px-3 py-2 text-xs text-[#087FF5]">Loading live and upcoming BetsAPI games…</p>}
    {(failed || !feed.configured || feed.errors.length > 0) && <p role="alert" className="mx-3 my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      BetsAPI fixtures are temporarily unavailable for {failed || !feed.configured ? 'the selected feed' : 'some sports'}. No previous provider data is shown.
    </p>}
    <HomeReference sports={sports} live={feed.live} upcoming={feed.upcoming}
      topBets={[]} topBetsUnavailable liveEnabled={false}
      liveTotal={feed.liveTotal} upcomingTotal={feed.upcomingTotal} />
  </div>;
}
