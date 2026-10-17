import { describe, expect, it } from 'vitest';
import { isMobileWageringAvailable } from '@/lib/mobile-wagering';

const enabledOperations = [
  { key: 'GLOBAL', isEnabled: true },
  { key: 'BETTING', isEnabled: true },
  { key: 'MAINTENANCE_MODE', isEnabled: false },
  { key: 'PREMATCH_BETTING', isEnabled: true },
  { key: 'LIVE_BETTING', isEnabled: true },
];

describe('mobile wagering availability (display only)', () => {
  it('tracks enabled server betting operations instead of permanently disabling the app', () => {
    expect(isMobileWageringAvailable(enabledOperations)).toBe(true);
  });

  it('allows the app to present prematch wagering when live wagering is disabled', () => {
    expect(isMobileWageringAvailable(enabledOperations.map((op) =>
      op.key === 'LIVE_BETTING' ? { ...op, isEnabled: false } : op,
    ))).toBe(true);
  });

  it.each(['GLOBAL', 'BETTING', 'PREMATCH_BETTING'])(
    'fails closed when a required operation is missing: %s',
    (key) => {
      const operations = enabledOperations.filter((op) => op.key !== key);
      if (key === 'PREMATCH_BETTING') {
        operations.find((op) => op.key === 'LIVE_BETTING')!.isEnabled = false;
      }
      expect(isMobileWageringAvailable(operations)).toBe(false);
    },
  );

  it('fails closed when maintenance is on or both betting modes are off', () => {
    expect(isMobileWageringAvailable(enabledOperations.map((op) =>
      op.key === 'MAINTENANCE_MODE' ? { ...op, isEnabled: true } : op,
    ))).toBe(false);
    expect(isMobileWageringAvailable(enabledOperations.map((op) =>
      ['LIVE_BETTING', 'PREMATCH_BETTING'].includes(op.key)
        ? { ...op, isEnabled: false } : op,
    ))).toBe(false);
  });

  it('rejects missing, corrupted, and duplicate configuration', () => {
    expect(isMobileWageringAvailable(null)).toBe(false);
    expect(isMobileWageringAvailable([])).toBe(false);
    expect(isMobileWageringAvailable([...enabledOperations, enabledOperations[0]!])).toBe(false);
    expect(isMobileWageringAvailable([
      ...enabledOperations,
      { key: 'EXTRA', isEnabled: 'true' as unknown as boolean },
    ])).toBe(false);
  });
});
