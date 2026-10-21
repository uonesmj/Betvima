import { describe, expect, it } from 'vitest';
import {
  DEMO_MAX_BET_CENTS, DEMO_STARTING_CENTS,
  demoCrashTarget, demoCrashMultiplier, demoRouletteColor,
  demoRoulettePayout, demoSlotPayout, parseDemoStake,
} from '@/lib/original-casino-demo';

describe('BetVima Originals demo-only outcome rules', () => {
  it('keeps the virtual-credit budget separate from real USD balances', () => {
    expect(DEMO_STARTING_CENTS).toBe(100_000);
    expect(DEMO_MAX_BET_CENTS).toBe(20_000);
    expect(parseDemoStake('10.05', 1_000_000)).toBe(1_005);
    expect(parseDemoStake('200', 20_000)).toBe(20_000);
    expect(parseDemoStake('200.01', 100_000)).toBeNull();
    expect(parseDemoStake('10.001', 100_000)).toBeNull();
    expect(parseDemoStake('-2', 100_000)).toBeNull();
    expect(parseDemoStake('1e9', 100_000)).toBeNull();
    expect(parseDemoStake('0.50', 100_000)).toBeNull();
    expect(parseDemoStake('100', 5_000)).toBeNull();
    expect(parseDemoStake('1.25', 125)).toBe(125);
    expect(parseDemoStake('100000', 100_000)).toBeNull();
  });

  it('produces finite bounded crash targets and a monotonic display', () => {
    expect(demoCrashTarget(0)).toBe(1);
    expect(demoCrashTarget(0.5)).toBe(1.98);
    expect(demoCrashTarget(0.999999)).toBe(50);
    expect(() => demoCrashTarget(-0.01)).toThrow();
    expect(() => demoCrashTarget(1)).toThrow();
    expect(() => demoCrashTarget(Number.NaN)).toThrow();
    const multipliers = [0, 1000, 3000, 6500, 10000, 25000].map(demoCrashMultiplier);
    expect(multipliers[0]).toBe(1);
    expect(multipliers.every((value, index) => index === 0 || value >= multipliers[index - 1])).toBe(true);
    expect(multipliers.every((value) => value <= 50)).toBe(true);
  });

  it('calculates standard single-zero roulette gross payouts', () => {
    expect(demoRouletteColor(0)).toBe('green');
    expect(demoRouletteColor(1)).toBe('red');
    expect(demoRouletteColor(2)).toBe('black');
    expect(demoRoulettePayout(0, 'zero')).toBe(36);
    expect(demoRoulettePayout(0, 'red')).toBe(0);
    expect(demoRoulettePayout(0, 'even')).toBe(0);
    expect(demoRoulettePayout(1, 'red')).toBe(2);
    expect(demoRoulettePayout(1, 'black')).toBe(0);
    expect(demoRoulettePayout(32, 'red')).toBe(2);
    expect(demoRoulettePayout(2, 'even')).toBe(2);
    expect(demoRoulettePayout(3, 'odd')).toBe(2);
    expect(() => demoRouletteColor(37)).toThrow();
    expect(() => demoRouletteColor(-1)).toThrow();
  });

  it('defines the illustrative slot paytable without wallet side effects', () => {
    expect(demoSlotPayout(['7️⃣', '7️⃣', '7️⃣'])).toBe(20);
    expect(demoSlotPayout(['💎', '💎', '💎'])).toBe(12);
    expect(demoSlotPayout(['🍒', '🍒', '🍒'])).toBe(4);
    expect(demoSlotPayout(['🍒', '🍒', '🍋'])).toBe(1.5);
    expect(demoSlotPayout(['🍒', '🍋', '🍒'])).toBe(0);
    expect(demoSlotPayout(['🍒', '🍋', '🔔'])).toBe(0);
    expect(() => demoSlotPayout(['🍒', '🍋'])).toThrow();
  });
});
