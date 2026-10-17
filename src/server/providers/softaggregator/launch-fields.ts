/**
 * Translate an authorized BetVima game request to the SoftAggregator API
 * contract. The provider does not accept player KYC/age verification fields.
 *
 * SoftAggregator documents country as optional by default (and mandatory for
 * some operator accounts). It is never needed for a demo. BetVima enforces
 * its own independently verified location/jurisdiction on cash requests in
 * the launch route and launchCasinoGame BEFORE this adapter is invoked.
 */
export function softAggregatorLaunchFields(input: {
  gameId: string;
  demo: boolean;
  lang: string;
  device: 'mobile' | 'desktop';
  country?: string;
}): Record<string, string> {
  return {
    gameid: input.gameId,
    currency: 'USD',
    // SoftAggregator's supported languages do not include Persian.
    lang: 'en',
    device: input.device,
    homeurl: 'https://betvima.com',
    ...(!input.demo && input.country ? { country: input.country } : {}),
  };
}
