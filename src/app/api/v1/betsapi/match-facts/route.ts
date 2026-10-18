import { jsonOk, withErrorHandling } from '@/lib/errors';
import { betsApiToken } from '@/server/betsapi-feed';
import { fetchMatchLiveFacts, fetchMatchBackground } from '@/providers/betsapi-match-facts';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Match facts only; no bookmaker markets, wager IDs or token exposed. */
export const GET = withErrorHandling('betsapi.match.facts', async (_ctx, request: Request) => {
  const q = new URL(request.url).searchParams;
  const fi = q.get('fi') || '';
  const sportId = Number(q.get('sportId'));
  const mode = q.get('mode');
  const section = q.get('section');
  if (!/^\d{1,16}$/.test(fi) || !BETSAPI_SPORTS.some(s => s.id === sportId) ||
      (mode !== 'live' && mode !== 'upcoming') ||
      (section !== 'stats' && section !== 'background')) {
    return jsonOk({ error: 'INVALID_FIXTURE', readOnly: true });
  }
  const token = betsApiToken();
  if (section === 'stats') {
    if (mode !== 'live') return jsonOk({
      fi, home: null, away: null, score: null, minute: null, stats: [],
      error: null, updatedAt: new Date().toISOString(),
    });
    return jsonOk(await fetchMatchLiveFacts(token, fi));
  }
  const home = (q.get('home') || '').trim().slice(0, 140);
  const away = (q.get('away') || '').trim().slice(0, 140);
  const kickoff = q.get('kickoff') || '';
  if (home.length < 2 || away.length < 2 || home === away ||
      !Number.isFinite(Date.parse(kickoff)) ||
      Math.abs(Date.parse(kickoff) - Date.now()) > 370 * 86400_000) {
    return jsonOk({ error: 'INVALID_FIXTURE', readOnly: true });
  }
  return jsonOk(await fetchMatchBackground(token, fi, sportId, home, away, kickoff));
});
