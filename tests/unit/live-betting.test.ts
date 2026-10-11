import { describe, expect, it, vi } from 'vitest';
import { isLiveBettingEnabled, readLiveBettingEnabled, readLiveCatalogue } from '@/server/live-betting';

describe('live betting operation switch', () => {
  it('enables live betting only for an explicit boolean true', () => {
    expect(isLiveBettingEnabled([{ key: 'LIVE_BETTING', isEnabled: true }])).toBe(true);
    expect(isLiveBettingEnabled([{ key: 'LIVE_BETTING', isEnabled: false }])).toBe(false);
    expect(isLiveBettingEnabled([{ key: 'LIVE_BETTING', isEnabled: 'true' }])).toBe(false);
    expect(isLiveBettingEnabled([{ key: 'LIVE_BETTING', isEnabled: 1 }])).toBe(false);
    expect(isLiveBettingEnabled([{ key: 'LIVE_BETTING', isEnabled: null }])).toBe(false);
    expect(isLiveBettingEnabled([
      { key: 'LIVE_BETTING', isEnabled: true },
      { key: 'LIVE_BETTING', isEnabled: false },
    ])).toBe(false);
  });

  it('disables live betting when the switch is missing or malformed', () => {
    expect(isLiveBettingEnabled([])).toBe(false);
    expect(isLiveBettingEnabled(null)).toBe(false);
    expect(isLiveBettingEnabled([{ key: 'BETTING', isEnabled: true }])).toBe(false);
  });

  it('disables live betting when reading operations fails', async () => {
    const admin = { operations: vi.fn().mockRejectedValue(new Error('database unavailable')) };
    await expect(readLiveBettingEnabled(admin)).resolves.toBe(false);
  });

  it('returns an unavailable live catalogue when its read fails', async () => {
    await expect(readLiveCatalogue(async () => { throw new Error('database unavailable'); }, [] as string[]))
      .resolves.toEqual({ value: [], unavailable: true });
  });
});
