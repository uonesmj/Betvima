import { describe, expect, it } from 'vitest';
import { selectExtendedEventMarkets } from '@/providers/extended-event-markets';

describe('The Odds API extended market selection', () => {
  it('requests offered configured markets, never just h2h/spreads/totals', () => {
    expect(selectExtendedEventMarkets(
      'correct_score,double_chance,alternate_totals,h2h',
      ['h2h', 'correct_score', 'double_chance', 'alternate_totals', 'player_points'],
      'h2h,spreads,totals',
    )).toEqual(['correct_score', 'double_chance', 'alternate_totals']);
  });

  it('does not invent absent or prohibited markets', () => {
    expect(selectExtendedEventMarkets(
      'correct_score,double_chance,alternate_totals,player_shots',
      ['spreads', 'correct_score', 'player_points'],
      'h2h,spreads,totals',
    )).toEqual(['correct_score']);
    expect(selectExtendedEventMarkets('correct_score,double_chance', ['h2h'], 'h2h')).toEqual([]);
  });

  it('does not purchase odds for markets requiring manual settlement review', () => {
    const configured = 'corners_1x2,alternate_totals_corners,alternate_spreads_cards,to_qualify,correct_score,btts';
    expect(selectExtendedEventMarkets(configured, configured.split(','), 'h2h,spreads,totals'))
      .toEqual(['correct_score','btts']);
  });

  it('deduplicates and caps expensive detail requests', () => {
    expect(selectExtendedEventMarkets(
      ' btts, btts, double_chance, correct_score, alternate_totals',
      ['btts','double_chance','correct_score','alternate_totals'],
      'h2h,totals,spreads',
      2,
    )).toEqual(['btts', 'double_chance']);
  });
});
