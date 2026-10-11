/**
 * Logo pipeline — name normalization + conservative team matching.
 *
 * Matching must be strict: a wrong badge on a team is worse than no badge,
 * so low-confidence candidates resolve to null.
 */
import { describe, expect, it } from 'vitest';
import {
  cacheKeyForName,
  matchTeamName,
  normalizeName,
  stripNoise,
} from '@/server/services/logo-sources/normalize';

describe('normalizeName', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeName('Deportivo Alavés')).toBe('deportivo alaves');
    expect(normalizeName('1. FC Köln')).toBe('1 fc koln');
  });

  it('collapses punctuation to single spaces', () => {
    expect(normalizeName('Paris Saint-Germain')).toBe('paris saint germain');
    expect(normalizeName('Brighton & Hove Albion')).toBe('brighton and hove albion');
  });
});

describe('stripNoise', () => {
  it('removes club affixes but keeps identity words', () => {
    expect(stripNoise(normalizeName('FC Koln'))).toBe('koln');
    expect(stripNoise(normalizeName('AS Roma'))).toBe('roma');
    expect(stripNoise(normalizeName('Real Madrid'))).toBe('real madrid');
    expect(stripNoise(normalizeName('Atletico Madrid'))).toBe('atletico madrid');
  });
});

describe('matchTeamName', () => {
  const premierLeague = [
    'Arsenal', 'Manchester City', 'Manchester United', 'Liverpool',
    'Tottenham Hotspur', 'Chelsea', 'Newcastle United', 'Brighton & Hove Albion',
    'West Ham United', 'Wolverhampton Wanderers', 'Nottingham Forest',
  ];

  it('matches exact names', () => {
    expect(matchTeamName('Arsenal', premierLeague)).toEqual({ candidate: 'Arsenal', confidence: 1 });
    expect(matchTeamName('Manchester City', premierLeague)?.confidence).toBe(1);
  });

  it('matches famous short names through aliases', () => {
    expect(matchTeamName('Man City', premierLeague)?.candidate).toBe('Manchester City');
    expect(matchTeamName('Spurs', premierLeague)?.candidate).toBe('Tottenham Hotspur');
    expect(matchTeamName('Wolves', premierLeague)?.candidate).toBe('Wolverhampton Wanderers');
    expect(matchTeamName('Inter', ['Internazionale', 'Inter Miami'])?.candidate).toBe('Internazionale');
    expect(matchTeamName('PSG', ['Paris Saint-Germain', 'Paris FC'])?.candidate).toBe('Paris Saint-Germain');
  });

  it('matches token subsets', () => {
    expect(matchTeamName('Brighton', premierLeague)?.candidate).toBe('Brighton & Hove Albion');
    expect(matchTeamName('Newcastle', premierLeague)?.candidate).toBe('Newcastle United');
    expect(matchTeamName('West Ham', premierLeague)?.candidate).toBe('West Ham United');
  });

  it('rejects junk and unknown names', () => {
    expect(matchTeamName('', premierLeague)).toBeNull();
    expect(matchTeamName('Real Madrid', premierLeague)).toBeNull();
    expect(matchTeamName('AS', premierLeague)).toBeNull();
  });

  it('builds stable cache keys', () => {
    expect(cacheKeyForName('Man City')).toBe('manchester city');
    expect(cacheKeyForName('FC Koln')).toBe('koln');
  });
});
