/**
 * Royal Neon — isolated, DEMO-ONLY slot mathematics.
 *
 * This module must NEVER be used to price or settle real-money wagers:
 * Math.random is deliberately only for a client-side visual prototype.
 * Real-money play requires an independently tested server-side RNG, audited
 * game mathematics and atomic wallet/ledger operations.
 */
export const REEL_COUNT = 5;
export const ROW_COUNT = 3;
export const STARTING_DEMO_CREDITS = 1000;

export const SYMBOLS = [
  'crown',
  'seven',
  'diamond',
  'ruby',
  'emerald',
  'star',
  'wild',
] as const;

export type SymbolId = (typeof SYMBOLS)[number];
export type ReelGrid = readonly (readonly SymbolId[])[];

export const SYMBOL_LABELS: Readonly<Record<SymbolId, string>> = {
  crown: 'Royal Crown',
  seven: 'Lucky Seven',
  diamond: 'Blue Diamond',
  ruby: 'Ruby',
  emerald: 'Emerald',
  star: 'Golden Star',
  wild: 'Wild',
};

// Multipliers for 3 / 4 / 5 matches on an active left-to-right payline.
// Total stake is split equally across 10 lines.
export const SYMBOL_MULTIPLIERS: Readonly<Record<SymbolId, readonly [number, number, number]>> = {
  crown: [10, 35, 150],
  seven: [8, 25, 110],
  diamond: [6, 18, 85],
  ruby: [5, 14, 65],
  emerald: [4, 12, 55],
  star: [3, 10, 45],
  wild: [12, 45, 200],
};

// Each array is the row index on reels 0..4.
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];

const WEIGHTED_SYMBOLS: readonly [SymbolId, number][] = [
  ['crown', 7],
  ['seven', 9],
  ['diamond', 13],
  ['ruby', 18],
  ['emerald', 20],
  ['star', 24],
  ['wild', 3],
];

const TOTAL_WEIGHT = WEIGHTED_SYMBOLS.reduce((sum, [, weight]) => sum + weight, 0);

export function randomSymbol(random: () => number = Math.random): SymbolId {
  const candidate = random();
  // Defend against invalid injected RNG output; never trust this for money.
  if (!Number.isFinite(candidate) || candidate < 0 || candidate >= 1) {
    throw new Error('Invalid demo RNG output');
  }
  let selection = candidate * TOTAL_WEIGHT;
  for (const [symbol, weight] of WEIGHTED_SYMBOLS) {
    if (selection < weight) return symbol;
    selection -= weight;
  }
  return 'star';
}

export function randomGrid(random: () => number = Math.random): ReelGrid {
  return Array.from({ length: REEL_COUNT }, () =>
    Array.from({ length: ROW_COUNT }, () => randomSymbol(random))
  );
}

export const INITIAL_GRID: ReelGrid = [
  ['crown', 'ruby', 'emerald'],
  ['seven', 'diamond', 'star'],
  ['diamond', 'crown', 'ruby'],
  ['emerald', 'seven', 'star'],
  ['wild', 'star', 'diamond'],
];

export type PaylineWin = Readonly<{
  line: number;
  symbol: SymbolId;
  count: number;
  payout: number;
  positions: readonly { reel: number; row: number }[];
}>;

export type SpinEvaluation = Readonly<{
  payout: number;
  wins: readonly PaylineWin[];
}>;

export function evaluateGrid(grid: ReelGrid, stake: number): SpinEvaluation {
  if (!Number.isInteger(stake) || stake <= 0 || stake % PAYLINES.length !== 0) {
    throw new Error('Stake must be a positive whole multiple of 10 demo credits');
  }
  if (grid.length !== REEL_COUNT || grid.some((reel) => reel.length !== ROW_COUNT ||
      reel.some((symbol) => !SYMBOLS.includes(symbol)))) {
    throw new Error('Invalid reel grid');
  }

  const lineStake = stake / PAYLINES.length;
  const wins: PaylineWin[] = [];

  PAYLINES.forEach((rows, lineIndex) => {
    const sequence = rows.map((row, reel) => grid[reel]![row]!);
    const mainSymbol = sequence.find((symbol) => symbol !== 'wild') ?? 'wild';
    let count = 0;
    for (const symbol of sequence) {
      if (symbol !== mainSymbol && symbol !== 'wild') break;
      count += 1;
    }

    if (count < 3) return;
    const multiplier = SYMBOL_MULTIPLIERS[mainSymbol][count - 3]!;
    const payout = lineStake * multiplier;
    wins.push({
      line: lineIndex + 1,
      symbol: mainSymbol,
      count,
      payout,
      positions: Array.from({ length: count }, (_, reel) => ({ reel, row: rows[reel]! })),
    });
  });

  return {
    payout: wins.reduce((sum, win) => sum + win.payout, 0),
    wins,
  };
}
