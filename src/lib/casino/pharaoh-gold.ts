/**
 * Pharaoh Gold demo-only math. No account, deposits, withdrawals, or real-money settlement.
 * Production requires audited RNG, certified paytable/RTP and atomic wallet integration.
 */
export const MIN_BET_CENTS = 10;
export const MAX_BET_CENTS = 10000;
export const PAYLINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
  [0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],
  [2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],
  [0,1,1,1,0],[2,1,1,1,2],[1,0,1,2,1],
  [1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,1,0,0],
  [2,2,1,2,2],[0,2,0,2,0],
] as const;

export const SYMBOLS = ['ankh', 'scarab', 'lotus', 'eye', 'queen', 'anubis', 'pharaoh', 'wild', 'scatter'] as const;
export type SymbolId = typeof SYMBOLS[number];
export type ReelGrid = SymbolId[][];
export type LineWin = { line: number; symbol: SymbolId; count: number; multiplier: number; amountCents: number };
export type SpinResult = {
  reels: ReelGrid;
  wins: LineWin[];
  winCents: number;
  scatterCount: number;
  freeSpinsAwarded: number;
  freeSpin: boolean;
  betCents: number;
  createdAt: string;
  roundId: string;
};

export const SYMBOL_LABELS: Record<SymbolId,string> = {
  ankh: 'ANKH', scarab: 'SCARAB', lotus: 'LOTUS', eye: 'EYE OF RA',
  queen: 'QUEEN', anubis: 'ANUBIS', pharaoh: 'PHARAOH', wild: 'WILD', scatter: 'SCATTER'
};
const WEIGHTS: ReadonlyArray<[SymbolId, number]> = [
  ['ankh',20],['scarab',18],['lotus',16],['eye',14],
  ['queen',11],['anubis',9],['pharaoh',6],['wild',3],['scatter',3],
];
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, entry) => sum + entry[1], 0);
export const PAYTABLE: Record<Exclude<SymbolId,'scatter'>, readonly [number,number,number]> = {
  ankh: [3,8,22], scarab:[4,10,25], lotus:[5,12,30],
  eye:[7,15,42], queen:[10,25,65], anubis:[14,35,90],
  pharaoh:[20,60,180], wild:[25,75,220],
};
export function validateBetCents(betCents: number): number {
  if (!Number.isSafeInteger(betCents) || betCents < MIN_BET_CENTS || betCents > MAX_BET_CENTS)
    throw new RangeError('Bet must be an integer number of USD cents between $0.10 and $100.00');
  return betCents;
}
export function pickSymbol(draw: (max: number) => number): SymbolId {
  let choice = draw(TOTAL_WEIGHT);
  if (!Number.isSafeInteger(choice) || choice < 0 || choice >= TOTAL_WEIGHT)
    throw new Error('Invalid RNG result');
  for (const [symbol, weight] of WEIGHTS) {
    if (choice < weight) return symbol;
    choice -= weight;
  }
  throw new Error('RNG exhausted');
}
export function evaluateGrid(grid: ReelGrid, betCents: number, freeSpin = false): Omit<SpinResult,'reels'|'freeSpin'|'betCents'|'createdAt'|'roundId'> {
  validateBetCents(betCents);
  if (grid.length !== 5 || grid.some(reel => reel.length !== 3 || reel.some(value => !SYMBOLS.includes(value))))
    throw new Error('Invalid reel grid');
  const wins: LineWin[] = [];
  PAYLINES.forEach((line, index) => {
    const sequence = line.map((row, reel) => grid[reel][row]);
    const firstPaying = sequence.find(symbol => symbol !== 'wild');
    const match = (firstPaying === 'scatter' ? undefined : firstPaying) || (sequence.every(x => x === 'wild') ? 'wild' : undefined);
    if (!match) return;
    let count = 0;
    for (const symbol of sequence) {
      if (symbol === match || symbol === 'wild') count++;
      else break;
    }
    if (count < 3) return;
    const multiplier = PAYTABLE[match as Exclude<SymbolId,'scatter'>][count - 3] * (freeSpin ? 2 : 1);
    wins.push({ line: index + 1, symbol: match, count, multiplier,
      amountCents: Math.round((betCents * multiplier) / PAYLINES.length) });
  });
  const scatterCount = grid.flat().filter(x => x === 'scatter').length;
  return {
    wins,
    winCents: wins.reduce((sum, win) => sum + win.amountCents, 0),
    scatterCount,
    freeSpinsAwarded: scatterCount >= 5 ? 20 : scatterCount === 4 ? 12 : scatterCount === 3 ? 8 : 0,
  };
}
export function createDemoSpin(
  betCents: number,
  freeSpin: boolean,
  draw: (max: number) => number,
  roundId: string,
): SpinResult {
  validateBetCents(betCents);
  if (typeof freeSpin !== 'boolean') throw new Error('Invalid bonus mode');
  const reels: ReelGrid = Array.from({length:5}, () => Array.from({length:3}, () => pickSymbol(draw)));
  const evaluation = evaluateGrid(reels, betCents, freeSpin);
  return { reels, ...evaluation, freeSpin, betCents, roundId, createdAt: new Date().toISOString() };
}
