import { describe, expect, it } from 'vitest';
import { createDemoSpin, evaluateGrid, parseDemoBalance, DEMO_START_CENTS, MAX_BET_CENTS, MIN_BET_CENTS, PAYLINES, SYMBOLS, validateBetCents, type ReelGrid } from '@/lib/casino/pharaoh-gold';
describe('Pharaoh Gold demo-only game engine', () => {
  it('starts a new browser session with USD $1000, never treating a missing key as zero', () => {
    expect(parseDemoBalance(null)).toBe(DEMO_START_CENTS);
    expect(parseDemoBalance('')).toBe(DEMO_START_CENTS);
    expect(parseDemoBalance('NaN')).toBe(DEMO_START_CENTS);
    expect(parseDemoBalance('-1')).toBe(DEMO_START_CENTS);
    expect(parseDemoBalance('10000001')).toBe(DEMO_START_CENTS);
    expect(parseDemoBalance('0')).toBe(0);
    expect(parseDemoBalance('99500')).toBe(99500);
  });
  it('enforces USD ten-cent minimum, integer cents and max', () => {
    expect(validateBetCents(MIN_BET_CENTS)).toBe(10);
    expect(validateBetCents(MAX_BET_CENTS)).toBe(10000);
    for (const amount of [0,9,10.5,-10,Infinity,NaN,10001])
      expect(() => validateBetCents(amount)).toThrow();
  });
  it('has twenty five-column paylines with in-range rows', () => {
    expect(PAYLINES).toHaveLength(20);
    for (const line of PAYLINES) {
      expect(line).toHaveLength(5);
      for (const row of line) expect([0,1,2]).toContain(row);
    }
    expect(new Set(SYMBOLS).size).toBe(SYMBOLS.length);
  });
  it('awards line wins with exact integer cents', () => {
    const grid: ReelGrid = Array.from({ length: 5 }, () => ['pharaoh','pharaoh','pharaoh']);
    const normal = evaluateGrid(grid, 100);
    const bonus = evaluateGrid(grid, 100, true);
    expect(normal.wins).toHaveLength(20);
    expect(normal.winCents).toBe(18000);
    expect(bonus.winCents).toBe(36000);
    expect(normal.wins.every(win => Number.isSafeInteger(win.amountCents))).toBe(true);
  });
  it('treats scatter as a bonus trigger and not a line symbol', () => {
    const grid: ReelGrid = [['scatter','ankh','lotus'],['scarab','scatter','eye'],['queen','lotus','scatter'],['eye','scarab','queen'],['anubis','ankh','lotus']];
    const result = evaluateGrid(grid, 10);
    expect(result.scatterCount).toBe(3);
    expect(result.freeSpinsAwarded).toBe(8);
    expect(result.wins.every(w => w.symbol !== 'scatter')).toBe(true);
  });
  it('keeps each demo spin bounded, serialized, and independent of any wallet', () => {
    let next = 0;
    const spin = createDemoSpin(10, false, max => (next++ % max), 'test-round');
    expect(spin.reels).toHaveLength(5);
    expect(spin.reels.flat()).toHaveLength(15);
    expect(spin.roundId).toBe('test-round');
    expect(spin.betCents).toBe(10);
    expect(spin.winCents).toBeGreaterThanOrEqual(0);
    expect(spin).not.toHaveProperty('walletId');
    expect(spin).not.toHaveProperty('balance');
  });
});
