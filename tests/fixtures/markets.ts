/**
 * Catalog fixtures: the market/selection shapes the rules engine consumes. Used by the market-rule,
 * grading and odds tests. Prices are scaled integers (10000 = 1.00) exactly as stored in the
 * database - never decimals.
 */
export interface MarketFixture {
  key: string;
  type: string;
  specifier: string | null;
  selections: { code: string; line: string | null; oddsScaled: bigint }[];
}

export const markets: MarketFixture[] = [
  {
    key: '1X2', type: '1X2', specifier: null,
    selections: [
      { code: 'HOME', line: null, oddsScaled: 21_000n },
      { code: 'DRAW', line: null, oddsScaled: 34_000n },
      { code: 'AWAY', line: null, oddsScaled: 36_000n },
    ],
  },
  {
    key: 'OU', type: 'OVER_UNDER', specifier: 'total=2.5',
    selections: [
      { code: 'OVER', line: '2.5', oddsScaled: 19_500n },
      { code: 'UNDER', line: '2.5', oddsScaled: 18_500n },
    ],
  },
  {
    key: 'HANDICAP', type: 'ASIAN_HANDICAP', specifier: 'hcp=-1',
    selections: [
      { code: 'HOME', line: '-1', oddsScaled: 23_000n },
      { code: 'AWAY', line: '-1', oddsScaled: 31_000n },
    ],
  },
  {
    key: 'BTTS', type: 'BTTS', specifier: null,
    selections: [
      { code: 'YES', line: null, oddsScaled: 17_500n },
      { code: 'NO', line: null, oddsScaled: 19_000n },
    ],
  },
];

/** A finished 2-1 home win, used against the market fixtures above. */
export const resultFixture = { homeScore: 2, awayScore: 1, extraTime: false, penalties: false };
