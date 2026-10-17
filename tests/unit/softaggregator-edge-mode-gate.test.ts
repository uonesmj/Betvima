import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  casinoRealMoneyEnabled, casinoRealMoneyUserAllowed,
} from '@/server/providers/softaggregator/client';

const testUser = '11111111-1111-4111-8111-111111111111';

describe('Casino money path requires trusted independent callback ingress', () => {
  beforeEach(() => {
    vi.stubEnv('SOFTAGGREGATOR_ENABLED', 'true');
    vi.stubEnv('SOFTAGGREGATOR_REAL_MONEY_ENABLED', 'true');
    vi.stubEnv('SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY', 'true');
    vi.stubEnv('SOFTAGGREGATOR_SALT_KEY', 'test-provider-salt-with-reasonable-length');
    vi.stubEnv('SOFTAGGREGATOR_TEST_USER_ID', testUser);
    vi.stubEnv('SOFTAGGREGATOR_CALLBACK_EDGE_READY', '');
    vi.stubEnv('SOFTAGGREGATOR_EDGE_HMAC_SECRET', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed if no independent Cloudflare edge readiness attestation exists', () => {
    vi.stubEnv('SOFTAGGREGATOR_EDGE_HMAC_SECRET', 'x'.repeat(48));
    expect(casinoRealMoneyEnabled()).toBe(false);
    expect(casinoRealMoneyUserAllowed(testUser)).toBe(false);
  });

  it('fails closed when attested edge has no separate authenticated secret', () => {
    vi.stubEnv('SOFTAGGREGATOR_CALLBACK_EDGE_READY', 'true');
    expect(casinoRealMoneyEnabled()).toBe(false);
    vi.stubEnv('SOFTAGGREGATOR_EDGE_HMAC_SECRET', 'short');
    expect(casinoRealMoneyEnabled()).toBe(false);
  });

  it('still requires provider salt, explicit schema and one-account pilot allowlist', () => {
    vi.stubEnv('SOFTAGGREGATOR_CALLBACK_EDGE_READY', 'true');
    vi.stubEnv('SOFTAGGREGATOR_EDGE_HMAC_SECRET', 'x'.repeat(48));
    expect(casinoRealMoneyEnabled()).toBe(true);
    expect(casinoRealMoneyUserAllowed(testUser)).toBe(true);
    expect(casinoRealMoneyUserAllowed('22222222-2222-4222-8222-222222222222')).toBe(false);

    vi.stubEnv('SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY', 'false');
    expect(casinoRealMoneyEnabled()).toBe(false);
    vi.stubEnv('SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY', 'true');
    vi.stubEnv('SOFTAGGREGATOR_SALT_KEY', '');
    expect(casinoRealMoneyEnabled()).toBe(false);
  });
});
