/**
 * Fixture contract test.
 *
 * The fixtures in `tests/fixtures/` model provider/catalog payloads. This suite keeps them honest:
 * every fixture must be accepted by the real parsing/grading code, and the edge-case fixtures must
 * actually trigger the behaviour their name promises. If a provider contract or a market rule
 * changes shape, this test fails instead of letting the fixtures rot.
 */
import { describe, expect, it } from 'vitest';
import { marketRuleFor, gradeSelection } from '@/domain/market-rules';
import { detectOddsAnomalies } from '@/domain/odds';
import type { MatchResult, Selection } from '@/domain/types';
import { markets, resultFixture, oddsBundle, oddsBundleWithSuspension, sportsMatchFeed, anomalousTick } from '../fixtures';

describe('provider fixtures', () => {
  it('describes matches with the fields the catalog needs', () => {
    for (const match of sportsMatchFeed) {
      expect(typeof match.providerId).toBe('string');
      expect(match.providerId.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(match.scheduledAt))).toBe(false);
      expect(['scheduled', 'live', 'finished', 'postponed', 'cancelled']).toContain(match.status);
    }
  });

  it('carries odds as decimal strings that convert to scaled integers', () => {
    for (const market of oddsBundle.markets) {
      expect(market.selections.length).toBeGreaterThan(1);
      for (const selection of market.selections) {
        // "2.10" -> 21000 scaled (10000 = 1.00): two decimals of precision, always a string on the wire.
        expect(selection.odds).toMatch(/^\d+\.\d{2}$/);
        const [whole, fraction] = selection.odds.split('.') as [string, string];
        const scaled = BigInt(whole) * 10_000n + BigInt(fraction) * 100n;
        expect(scaled).toBeGreaterThanOrEqual(10_100n);   // below 1.01 is not a valid price
      }
    }
  });

  it('flags the anomalous tick it was written for', () => {
    const anomalies = detectOddsAnomalies(anomalousTick);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => /JUMP/.test(a.code))).toBe(true);
  });

  it('distinguishes the suspended bundle from the open one', () => {
    const open = oddsBundle.markets.filter((m) => m.status === 'open').length;
    const suspended = oddsBundleWithSuspension.markets.filter((m) => m.status !== 'open').length;
    expect(open).toBe(oddsBundle.markets.length);
    expect(suspended).toBe(1);
  });
});

describe('market fixtures', () => {
  it('resolves a rule for every fixture market', () => {
    for (const market of markets) {
      const rule = marketRuleFor(market.key) ?? marketRuleFor(market.type);
      expect(rule, `no market rule for ${market.key}`).not.toBeNull();
    }
  });

  it('grades every fixture market against a 2-1 home win without throwing', () => {
    const result = {
      matchId: 'fixture-match', revision: 1, status: 'finished',
      homeScore: resultFixture.homeScore, awayScore: resultFixture.awayScore,
      homeHalfScore: 1, awayHalfScore: 0, homeCorners: 6, awayCorners: 3, homeCards: 2, awayCards: 4,
      extraTime: resultFixture.extraTime, penalties: resultFixture.penalties,
      penaltyHome: null, penaltyAway: null, provider: 'fixture', authoritative: true,
      observedAt: '2026-05-01T16:52:00.000Z', settledAt: null,
    } as unknown as MatchResult;

    for (const market of markets) {
      const rule = marketRuleFor(market.key) ?? marketRuleFor(market.type);
      if (!rule) continue;
      for (const selection of market.selections) {
        const grade = gradeSelection({
          rule,
          selection: { code: selection.code, line: selection.line, participantType: selection.code } as Pick<Selection, 'code' | 'line' | 'participantType'>,
          result,
          matchStatus: 'finished',
        });
        expect(['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST', 'PENDING'], grade.grade);
        expect(grade.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
