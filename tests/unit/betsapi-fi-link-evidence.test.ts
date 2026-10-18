import { describe, expect, it } from 'vitest';
import { evaluateBet365FixtureLink, type FixtureLinkEvidence } from '../../src/providers/betsapi-fi-link-evidence';
const fixture: FixtureLinkEvidence = {
  bookmaker: { id: '203034631', home: 'Home FC', away: 'Away FC', startsAt: '2026-10-18T12:00:00Z' },
  events: { id: '1:203034631', home: 'Home FC', away: 'Away FC', startsAt: '2026-10-18T12:01:00Z' },
  corroboration: null,
};
const now = new Date('2026-10-18T13:00:00Z');
describe('Bet365 independent fixture identity evidence', () => {
  it('never considers matching numeric ID or team name independently verified', () => {
    const verdict = evaluateBet365FixtureLink(fixture, now);
    expect(verdict.candidate).toBe(true);
    expect(verdict.verified).toBe(false);
    expect(verdict.reasons).toContain('NO_INDEPENDENT_CORROBORATION');
  });
  it('rejects mismatched teams even when proof exists', () => {
    const verdict = evaluateBet365FixtureLink({
      ...fixture,
      bookmaker: { ...fixture.bookmaker, away: 'Another Team' },
      corroboration: {source: 'provider_mapping', reference: 'provider:ref123', mappedBookmakerFi: '203034631', mappedEventsProviderId: '1:203034631', verifiedAt: now.toISOString()},
    }, now);
    expect(verdict.verified).toBe(false);
    expect(verdict.reasons).toContain('TEAM_MISMATCH');
  });
  it('rejects stale evidence', () => {
    const verdict = evaluateBet365FixtureLink({...fixture, corroboration: {
      source: 'operator_verified', reference: 'audit:link123', mappedBookmakerFi: '203034631', mappedEventsProviderId: '1:203034631', verifiedAt: '2026-10-16T12:00:00Z',
    }}, now);
    expect(verdict.verified).toBe(false);
    expect(verdict.reasons).toContain('STALE_CORROBORATION');
  });
  it('rejects a plausible but differently mapped bookmaker FI', () => {
    const verdict = evaluateBet365FixtureLink({...fixture, corroboration: {
      source: 'provider_mapping', reference: 'provider:ref123',
      mappedBookmakerFi: '203034632', mappedEventsProviderId: '1:203034631', verifiedAt: now.toISOString(),
    }}, now);
    expect(verdict.verified).toBe(false);
    expect(verdict.reasons).toContain('CORROBORATED_ID_MISMATCH');
  });
  it('accepts independently corroborated consistent identity evidence', () => {
    const verdict = evaluateBet365FixtureLink({...fixture, corroboration: {
      source: 'provider_mapping', reference: 'provider:ref123', mappedBookmakerFi: '203034631', mappedEventsProviderId: '1:203034631', verifiedAt: now.toISOString(),
    }}, now);
    expect(verdict.verified).toBe(true);
  });
});
