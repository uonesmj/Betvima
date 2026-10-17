import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/casino/demo/route';
import { launchCasinoGame } from '@/server/providers/softaggregator/client';
import { enforceRateLimit } from '@/server/http/request';

vi.mock('@/lib/errors', () => ({
  withErrorHandling: (
    _name: string,
    handler: (context: { correlationId: string }, request: Request) => Promise<Response>,
  ) => (request: Request) => handler({ correlationId: 'test-casino-demo' }, request),
}));

vi.mock('@/server/http/guard', () => ({
  withUser: vi.fn(async () => ({
    user: { id: '11111111-1111-4111-8111-111111111111', status: 'active' },
  })),
}));

vi.mock('@/server/http/request', () => ({
  readJson: async (request: Request, schema: { parse(value: unknown): unknown }) =>
    schema.parse(await request.json()),
  enforceRateLimit: vi.fn(async () => {}),
}));

vi.mock('@/server/providers/softaggregator/client', () => ({
  casinoEnabled: () => true,
  launchCasinoGame: vi.fn(async () => 'https://games.example.test/sandbox-only'),
}));

const launch = POST as unknown as (request: Request) => Promise<Response>;

function request(body: Record<string, unknown>): Request {
  return new Request('https://betvima.com/api/v1/casino/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Casino website demo-only route without customer KYC/age/country', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not require a profile country or KYC and can only launch a provider demo', async () => {
    const response = await launch(request({ gameId: 'test/Aviator', device: 'mobile', lang: 'fa' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true, data: {
        url: 'https://games.example.test/sandbox-only', currency: 'USD', demo: true,
      },
    });
    expect(vi.mocked(launchCasinoGame)).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-8111-111111111111',
      gameId: 'test/Aviator',
      device: 'mobile', lang: 'fa', demo: true,
    });
    expect(vi.mocked(enforceRateLimit)).toHaveBeenCalledWith(
      'casino:launch:11111111-1111-4111-8111-111111111111', 20, 60,
    );
  });

  it('rejects client-supplied cash mode and identity fields rather than changing modes', async () => {
    await expect(launch(request({
      gameId: 'test/Aviator', demo: false,
      ageVerified: false, kycStatus: 'not_started', country: 'ZZ',
    }))).rejects.toThrow();
    expect(launchCasinoGame).not.toHaveBeenCalled();
  });

  it('defaults to mobile demo and rejects an invalid game identifier', async () => {
    const response = await launch(request({ gameId: 'test/Aviator' }));
    expect(response.ok).toBe(true);
    expect(vi.mocked(launchCasinoGame)).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-8111-111111111111',
      gameId: 'test/Aviator', device: 'mobile', lang: 'en', demo: true,
    });
    vi.mocked(launchCasinoGame).mockClear();
    await expect(launch(request({ gameId: '' }))).rejects.toThrow();
    expect(launchCasinoGame).not.toHaveBeenCalled();
  });
});
