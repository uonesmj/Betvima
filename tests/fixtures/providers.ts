/**
 * Provider-shaped fixtures. These mirror the payloads described by
 * `src/lib/ports/providers.ts` so adapters, mappers and the odds/result pipelines can be
 * exercised deterministically. No live provider is contacted.
 */
import type {
  ProviderMatch, ProviderOddsBundle, ProviderResultSnapshot,
} from '@/lib/ports/providers';

export const sportsMatchFeed: ProviderMatch[] = [
  {
    providerId: 'fx-match-1001', sport: 'football', leagueProviderId: 'fx-league-10', leagueName: 'Fixture League',
    countryCode: 'IR', homeTeamName: 'Fixture Home', awayTeamName: 'Fixture Away',
    scheduledAt: '2026-05-01T15:00:00.000Z', status: 'scheduled',
    homeScore: null, awayScore: null, minute: null, period: null,
  },
  {
    providerId: 'fx-match-1002', sport: 'football', leagueProviderId: 'fx-league-10', leagueName: 'Fixture League',
    countryCode: 'IR', homeTeamName: 'Fixture City', awayTeamName: 'Fixture United',
    scheduledAt: '2026-05-01T17:30:00.000Z', status: 'live',
    homeScore: 1, awayScore: 0, minute: 37, period: '1H',
  },
];

export const oddsBundle: ProviderOddsBundle = {
  matchProviderId: 'fx-match-1001',
  updatedAt: '2026-05-01T14:55:00.000Z',
  markets: [
    {
      providerId: 'fx-market-1x2', key: '1X2', type: '1X2', specifier: null, isLive: false, status: 'open',
      selections: [
        { providerId: 'fx-sel-home', code: 'HOME', name: 'Fixture Home', line: null, odds: '2.10', status: 'open' },
        { providerId: 'fx-sel-draw', code: 'DRAW', name: 'Draw', line: null, odds: '3.40', status: 'open' },
        { providerId: 'fx-sel-away', code: 'AWAY', name: 'Fixture Away', line: null, odds: '3.60', status: 'open' },
      ],
    },
    {
      providerId: 'fx-market-total', key: 'TOTAL_2_5', type: 'TOTAL', specifier: 'total=2.5', isLive: false, status: 'open',
      selections: [
        { providerId: 'fx-sel-over', code: 'OVER', name: 'Over 2.5', line: '2.5', odds: '1.95', status: 'open' },
        { providerId: 'fx-sel-under', code: 'UNDER', name: 'Under 2.5', line: '2.5', odds: '1.85', status: 'open' },
      ],
    },
  ],
};

/** A bundle with one leg suspended by the provider - used to prove suspension is respected. */
export const oddsBundleWithSuspension: ProviderOddsBundle = {
  ...oddsBundle,
  markets: [
    oddsBundle.markets[0]!,
    { ...oddsBundle.markets[1]!, status: 'suspended' },
  ],
};

export const resultSnapshot: ProviderResultSnapshot = {
  matchProviderId: 'fx-match-1001', status: 'finished',
  homeScore: 2, awayScore: 1, homeHalfScore: 1, awayHalfScore: 0,
  homeCorners: 6, awayCorners: 3, homeCards: 2, awayCards: 4,
  extraTime: false, penalties: false, penaltyHome: null, penaltyAway: null,
  revision: 1, observedAt: '2026-05-01T16:52:00.000Z', authoritative: true,
};

export const webhookEnvelope = {
  body: JSON.stringify({ eventId: 'fx-event-1', type: 'payment.succeeded', reference: 'fx-ref-1', amount: '250000', currency: 'IRT' }),
  headers: { 'x-signature': 'fx-signature', 'x-timestamp': '1775000000' } as Record<string, string>,
};

/** Odds that moved far enough in one tick (21,000 -> 41,000 = +95%) that ingestion must flag them. */
export const anomalousTick = {
  odds: 41_000n, previousOdds: 21_000n,
  providerTimestamp: new Date('2026-05-01T15:02:00.000Z'),
  ingestedAt: new Date('2026-05-01T15:02:01.000Z'),
  maxAgeSeconds: 45,
};
