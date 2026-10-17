import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchCasinoGame } from '@/server/providers/softaggregator/client';

const userId = '11111111-1111-4111-8111-111111111111';
const sampleGame = 'sandbox/SampleSlot';

describe('SoftAggregator country-free demo (no financial movement)', () => {
  let methods: Array<Record<string, unknown>>;
  beforeEach(() => {
    methods = [];
    vi.stubEnv('SOFTAGGREGATOR_ENABLED', 'true');
    vi.stubEnv('SOFTAGGREGATOR_REAL_MONEY_ENABLED', 'false');
    vi.stubEnv('SOFTAGGREGATOR_API_LOGIN', 'unit-test-only-login');
    vi.stubEnv('SOFTAGGREGATOR_API_PASSWORD', 'unit-test-only-password');
    vi.stubEnv('SOFTAGGREGATOR_PLAYER_SECRET', 'synthetic-player-secret-no-production-credentials');
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const input = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      methods.push(input);
      switch (input.method) {
        case 'getGameList':
          return Response.json({ error: 0, response: [{
            id_hash: sampleGame, name: 'Sample Slot', provider: 'test',
            game_type: 'video-slots', play_for_fun_supported: true,
          }] });
        case 'createPlayer':
          return Response.json({ error: 0, response: { created: true } });
        case 'getGameDemo':
          return Response.json({ error: 0, response: {
            gameurl: 'https://games.example.test/session/demo',
          } });
        default:
          throw new Error('Unexpected provider method ' + String(input.method));
      }
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('launches USD demo for a user with no country, no KYC or wallet calls', async () => {
    const url = await launchCasinoGame({
      userId, gameId: sampleGame, demo: true, lang: 'en', device: 'mobile',
      // Deliberately NO country: the sandbox must never need a profile country.
    });
    expect(url).toBe('https://games.example.test/session/demo');
    expect(methods.map(x => x.method)).toEqual([
      'getGameList', 'createPlayer', 'getGameDemo',
    ]);
    expect(methods.every(x => !Object.hasOwn(x, 'country'))).toBe(true);
    expect(methods.every(x => x.currency === undefined || x.currency === 'USD')).toBe(true);
    expect(methods.some(x => x.method === 'getGame')).toBe(false);
    expect(methods.some(x => ['debit', 'credit', 'balance'].includes(String(x.method)))).toBe(false);
  });

  it('never falls back to money play when a provider refuses demo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const input = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      methods.push(input);
      if (input.method === 'getGameList') return Response.json({error:0,response:[{
        id_hash:'sandbox/RejectDemo',name:'Demo denied',provider:'test',game_type:'video-slots',
      }]});
      if (input.method === 'createPlayer') return Response.json({error:0,response:{}});
      return Response.json({error:3,message:'demo unsupported'});
    }));
    // Cached catalogues are not critical to this assertion: an invalid/unsupported
    // game must never trigger an accidental real-money request either.
    await expect(launchCasinoGame({
      userId, gameId: sampleGame, demo: false, lang: 'en', device: 'mobile',
    })).rejects.toThrow('CASINO_REAL_MONEY_DISABLED');
    expect(methods).toHaveLength(0);
  });
});
