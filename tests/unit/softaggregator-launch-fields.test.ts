import { describe, expect, it } from 'vitest';
import { softAggregatorLaunchFields } from '@/server/providers/softaggregator/launch-fields';

describe('SoftAggregator launch contract (separate from BetVima eligibility)', () => {
  it('never sends KYC, age or country on demo launch', () => {
    const fields = softAggregatorLaunchFields({
      gameId: 'demo/Aviator', demo: true, lang: 'fa',
      device: 'mobile', country: 'DE',
    });
    expect(fields).toEqual({
      gameid: 'demo/Aviator', currency: 'USD', lang: 'en',
      device: 'mobile', homeurl: 'https://betvima.com',
    });
    expect(Object.keys(fields)).not.toContain('kyc_status');
    expect(Object.keys(fields)).not.toContain('age_verified');
  });

  it('forwards independently authorized country for real-money getGame', () => {
    expect(softAggregatorLaunchFields({
      gameId: 'slots/Test', demo: false, lang: 'en',
      device: 'desktop', country: 'DE',
    })).toEqual({
      gameid: 'slots/Test', currency: 'USD', lang: 'en',
      device: 'desktop', homeurl: 'https://betvima.com', country: 'DE',
    });
  });

  it('models provider optional-country contract without changing money access controls', () => {
    const fields = softAggregatorLaunchFields({
      gameId: 'slots/Test', demo: false, lang: 'en',
      device: 'desktop',
    });
    expect(fields).not.toHaveProperty('country');
    // Cash execution without an authorized country is still rejected upstream
    // by launchCasinoGame and the independently verified launch route.
  });
});
