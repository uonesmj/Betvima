import { describe, expect, it } from 'vitest';
import { sportsTeamSlug } from '@/workers/sports-team-slug';

describe('provider fixture team identity', () => {
  it('preserves existing Latin team keys for historical providers', () => {
    expect(sportsTeamSlug('Real Madrid', 'the_odds_api', '123')).toBe('real-madrid');
    expect(sportsTeamSlug('Liverpool FC', '5dollarfootballapi', null)).toBe('liverpool-fc');
  });
  it('keeps non-Latin opponents distinct under BetsAPI', () => {
    const home = sportsTeamSlug('پرسپولیس', 'betsapi', '125');
    const away = sportsTeamSlug('استقلال', 'betsapi', '126');
    expect(home).toBe('betsapi-team-125');
    expect(away).toBe('betsapi-team-126');
    expect(home).not.toBe(away);
  });
  it('never collapses no-ID Persian teams to the same empty slug', () => {
    const a = sportsTeamSlug('استقلال خوزستان', 'betsapi', null);
    const b = sportsTeamSlug('استقلال تهران', 'betsapi', null);
    expect(a).not.toBe(b);
    expect(sportsTeamSlug('استقلال خوزستان', 'betsapi', null)).toBe(a);
    expect(a).toMatch(/^betsapi-team-[a-f0-9]{24}$/);
  });
  it('does not alias different source teams that happen to have the same English display name', () => {
    expect(sportsTeamSlug('United', 'betsapi', '872'))
      .not.toBe(sportsTeamSlug('United', 'betsapi', '991'));
  });
});
