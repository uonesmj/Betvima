import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casinoGames, launchCasinoGame, parsePrivateDemoConfig, casinoRealMoneyEnabled, casinoRealMoneyUserAllowed, SOFTAGGREGATOR_USER_AGENT } from '@/server/providers/softaggregator/client';

describe('SoftAggregator demo-only launch API', () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SOFTAGGREGATOR_ENABLED = 'true';
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'false';
    process.env.SOFTAGGREGATOR_API_LOGIN = 'dummy-test-login';
    process.env.SOFTAGGREGATOR_API_PASSWORD = 'dummy-test-password';
    process.env.SOFTAGGREGATOR_PLAYER_SECRET = 'test-secret-at-least-32-characters-long';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...original };
  });

  it('launches a vendor-confirmed demo even when catalogue reports false, with player identity', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const userAgents: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const headers = new Headers(options.headers);
      userAgents.push(headers.get('user-agent') ?? '');
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      calls.push(body);
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'slots',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: { gameurl: 'https://cdn.provider.test/play?token=random' } }),
      };
      throw new Error('Unexpected provider method: ' + body.method);
    }));

    const list = await casinoGames();
    expect(list).toHaveLength(1);
    const url = await launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: list[0]!.id_hash, demo: true, lang: 'en', device: 'mobile',
    });
    expect(url.startsWith('https://cdn.provider.test/')).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['getGameList', 'createPlayer', 'getGameDemo']);
    expect(userAgents).toEqual(Array(3).fill(SOFTAGGREGATOR_USER_AGENT));
    expect(calls[1]).toHaveProperty('currency', 'USD');
    expect(calls[1]).toHaveProperty('user_username');
    expect(calls[1]).toHaveProperty('user_password');
    expect(calls[2]).toHaveProperty('user_username', calls[1]!.user_username);
    expect(calls[2]).toHaveProperty('user_password', calls[1]!.user_password);
    expect(calls[2]).toHaveProperty('gameid', 'x887bde40b16350c');
  });


  it('returns a typed non-monetary error when the supplier rejects a demo', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      calls.push(String(body.method));
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({
          error: 1, message: 'Not authorized to provide demo', response: null,
        }),
      };
      throw new Error('Unexpected provider method');
    }));
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'x887bde40b16350c',
      demo: true, lang: 'en', device: 'mobile',
    })).rejects.toThrow('CASINO_DEMO_UNAVAILABLE');
    expect(calls).toContain('getGameDemo');
    expect(calls).not.toContain('getGame');
  });

  it('does not label a network outage as a non-playable title', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio',
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: false, status: 503,
      };
      throw new Error('Unexpected method');
    }));
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'x887bde40b16350c',
      demo: true, lang: 'en', device: 'mobile',
    })).rejects.toThrow('SOFTAGGREGATOR_HTTP_ERROR');
  });

  it('retains compatibility with a direct-string launch response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: 'https://cdn.provider.test/legacy' }),
      };
      throw new Error('Unexpected method');
    }));
    const url = await launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'x887bde40b16350c', demo: true, lang: 'en', device: 'mobile',
    });
    expect(url).toBe('https://cdn.provider.test/legacy');
  });

  it('rejects malformed or insecure gameurl responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio', play_for_fun_supported: false,
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGameDemo') return {
        ok: true, json: async () => ({ error: 0, response: { gameurl: 'http://insecure.test/play' } }),
      };
      throw new Error('Unexpected method');
    }));
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'x887bde40b16350c', demo: true, lang: 'en', device: 'mobile',
    })).rejects.toThrow('INVALID_CASINO_LAUNCH_URL');
  });

  it('parses only expected demo-only private fields', () => {
    const parsed = parsePrivateDemoConfig({
      enabled: true,
      apiLogin: 'sample-login',
      apiPassword: 'sample-password',
      playerSecret: 'a'.repeat(64),
      realMoneyEnabled: true,
    });
    expect(parsed).toEqual({
      enabled: true, apiLogin: 'sample-login',
      apiPassword: 'sample-password', playerSecret: 'a'.repeat(64),
    });
    expect(casinoRealMoneyEnabled()).toBe(false);
    expect(parsePrivateDemoConfig(null)).toEqual({});
    expect(parsePrivateDemoConfig(['incorrect'])).toEqual({});
    expect(parsePrivateDemoConfig({
      enabled: 'true',
      apiLogin: 1,
      apiPassword: true,
      playerSecret: 'short',
    })).toEqual({
      enabled: false, apiLogin: '', apiPassword: '', playerSecret: '',
    });
  });

  it('never grants real-money play without a specific allowlisted account', () => {
    const pilot = '00000000-0000-4000-8000-000000000001';
    const other = '00000000-0000-4000-8000-000000000002';
    process.env.SOFTAGGREGATOR_ENABLED = 'true';
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'true';
    process.env.SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY = 'true';
    process.env.SOFTAGGREGATOR_SALT_KEY = 'staging-contract-test-salt';
    process.env.SOFTAGGREGATOR_CALLBACK_EDGE_READY = 'true';
    process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET = 'staging-independent-edge-hmac-secret-32-plus-chars';
    delete process.env.SOFTAGGREGATOR_TEST_USER_ID;
    expect(casinoRealMoneyUserAllowed(pilot)).toBe(false);
    process.env.SOFTAGGREGATOR_TEST_USER_ID = pilot;
    expect(casinoRealMoneyUserAllowed(pilot)).toBe(true);
    expect(casinoRealMoneyUserAllowed(other)).toBe(false);
    process.env.SOFTAGGREGATOR_TEST_USER_ID = '*';
    expect(casinoRealMoneyUserAllowed(pilot)).toBe(false);
    process.env.SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY = 'false';
    process.env.SOFTAGGREGATOR_TEST_USER_ID = pilot;
    expect(casinoRealMoneyUserAllowed(pilot)).toBe(false);
    process.env.SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY = 'true';
    delete process.env.SOFTAGGREGATOR_SALT_KEY;
    expect(casinoRealMoneyUserAllowed(pilot)).toBe(false);
    process.env.SOFTAGGREGATOR_SALT_KEY = 'staging-contract-test-salt';
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'false';
    process.env.SOFTAGGREGATOR_TEST_USER_ID = pilot;
    expect(casinoRealMoneyUserAllowed(pilot)).toBe(false);
  });

  it('accepts only 1–20 explicitly listed pilot UUIDs and refuses public or conflicting access', () => {
    const id = (n: number) => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');
    Object.assign(process.env, {
      SOFTAGGREGATOR_ENABLED: 'true',
      SOFTAGGREGATOR_REAL_MONEY_ENABLED: 'true',
      SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY: 'true',
      SOFTAGGREGATOR_SALT_KEY: 'staging-contract-test-salt',
      SOFTAGGREGATOR_CALLBACK_EDGE_READY: 'true',
      SOFTAGGREGATOR_EDGE_HMAC_SECRET: 'staging-independent-edge-hmac-secret-32-plus-chars',
    });
    delete process.env.SOFTAGGREGATOR_TEST_USER_ID;
    process.env.SOFTAGGREGATOR_PILOT_USER_IDS = Array.from({ length: 20 }, (_, index) => id(index + 1)).join(',');
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(true);
    expect(casinoRealMoneyUserAllowed(id(10))).toBe(true);
    expect(casinoRealMoneyUserAllowed(id(20))).toBe(true);
    expect(casinoRealMoneyUserAllowed(id(21))).toBe(false);

    process.env.SOFTAGGREGATOR_PILOT_USER_IDS += ',' + id(21);
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);
    process.env.SOFTAGGREGATOR_PILOT_USER_IDS = id(1) + ',' + id(1);
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);
    process.env.SOFTAGGREGATOR_PILOT_USER_IDS = id(1) + ',';
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);
    process.env.SOFTAGGREGATOR_PILOT_USER_IDS = id(1) + ',*';
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);
    process.env.SOFTAGGREGATOR_PILOT_USER_IDS = id(1);
    process.env.SOFTAGGREGATOR_TEST_USER_ID = id(1);
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);

    delete process.env.SOFTAGGREGATOR_TEST_USER_ID;
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'false';
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);
    process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED = 'true';
    process.env.SOFTAGGREGATOR_CALLBACK_EDGE_READY = 'false';
    expect(casinoRealMoneyUserAllowed(id(1))).toBe(false);
  });

  it('always sends an authorized ISO country to supplier getGame for real-money play', async () => {
    const pilot = '00000000-0000-4000-8000-000000000001';
    Object.assign(process.env, {
      SOFTAGGREGATOR_ENABLED: 'true',
      SOFTAGGREGATOR_REAL_MONEY_ENABLED: 'true',
      SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY: 'true',
      SOFTAGGREGATOR_SALT_KEY: 'fake-provider-test-salt-key',
      SOFTAGGREGATOR_CALLBACK_EDGE_READY: 'true',
      SOFTAGGREGATOR_EDGE_HMAC_SECRET: 'staging-independent-edge-hmac-secret-32-plus-chars',
      SOFTAGGREGATOR_TEST_USER_ID: pilot,
      SOFTAGGREGATOR_ALLOWED_COUNTRIES: 'DE',
    });
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', vi.fn(async (_: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>;
      calls.push(body);
      if (body.method === 'getGameList') return {
        ok: true, json: async () => ({ error: 0, response: [{
          id_hash: 'x887bde40b16350c', name: 'Aviator', game_type: 'crash',
          provider: 'studio',
        }] }),
      };
      if (body.method === 'createPlayer') return {
        ok: true, json: async () => ({ error: 0, response: { created: true } }),
      };
      if (body.method === 'getGame') return {
        ok: true, json: async () => ({ error: 0, response: {
          gameurl: 'https://cdn.provider.test/real-game',
        } }),
      };
      throw new Error('Unexpected method');
    }));
    const url = await launchCasinoGame({
      userId: pilot, gameId: 'x887bde40b16350c',
      demo: false, lang: 'fa', device: 'mobile', country: 'DE',
    });
    expect(url).toBe('https://cdn.provider.test/real-game');
    const cashLaunch = calls.find((call) => call.method === 'getGame');
    expect(cashLaunch).toMatchObject({ country: 'DE', currency: 'USD',
      gameid: 'x887bde40b16350c' });
    expect(calls.some((call) => call.method === 'getGameDemo')).toBe(false);
  });

  it('refuses any missing, malformed, or non-authorized country before supplier player creation', async () => {
    const pilot = '00000000-0000-4000-8000-000000000001';
    Object.assign(process.env, {
      SOFTAGGREGATOR_ENABLED: 'true',
      SOFTAGGREGATOR_REAL_MONEY_ENABLED: 'true',
      SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY: 'true',
      SOFTAGGREGATOR_SALT_KEY: 'fake-provider-test-salt-key',
      SOFTAGGREGATOR_CALLBACK_EDGE_READY: 'true',
      SOFTAGGREGATOR_EDGE_HMAC_SECRET: 'staging-independent-edge-hmac-secret-32-plus-chars',
      SOFTAGGREGATOR_TEST_USER_ID: pilot,
      SOFTAGGREGATOR_ALLOWED_COUNTRIES: 'DE',
    });
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    for (const country of [undefined, '', 'de', 'FR', 'XX', '*']) {
      await expect(launchCasinoGame({
        userId: pilot, gameId: 'x887bde40b16350c',
        demo: false, lang: 'en', device: 'mobile', country,
      })).rejects.toThrow('CASINO_COUNTRY_NOT_AUTHORIZED');
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses real-money game access independently of provider credentials', async () => {
    await expect(launchCasinoGame({
      userId: '00000000-0000-4000-8000-000000000001',
      gameId: 'studio/demo2026', demo: false, lang: 'en', device: 'mobile',
    })).rejects.toThrow('CASINO_REAL_MONEY_DISABLED');
  });
});
