import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/v1/casino/demo/pharaoh-gold/route';

const url = (betCents: string, freeSpin = 'false') =>
  'https://preview.betvima.com/api/v1/casino/demo/pharaoh-gold?' + new URLSearchParams({ betCents, freeSpin, nonce: 'test' });

describe('Pharaoh Gold GET-only preview demo API', () => {
  it('provides a fresh, non-cached, USD-denominated demo spin without touching any wallet', async () => {
    const res = await GET(new Request(url('10')));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const data = await res.json();
    expect(data.mode).toBe('demo');
    expect(data.currency).toBe('USD');
    expect(data.result.betCents).toBe(10);
    expect(data.result.reels).toHaveLength(5);
    expect(data.result.reels.flat()).toHaveLength(15);
    expect(data.result).not.toHaveProperty('balance');
    expect(data.result).not.toHaveProperty('walletId');
  });
  it('rejects malformed, fractional or below-minimum stakes, and invalid bonus flag', async () => {
    const cases = [url('9'), url('0'), url('10.5'), url('-1'), url('10001'), url('10', 'invalid'), 'https://preview.betvima.com/api/v1/casino/demo/pharaoh-gold'];
    for (const requestUrl of cases) {
      const res = await GET(new Request(requestUrl));
      expect(res.status, requestUrl).toBe(400);
      expect(res.headers.get('Cache-Control'), requestUrl).toContain('no-store');
    }
  });
  it('accepts a free spin but returns no settlement or credit side effects', async () => {
    const res = await GET(new Request(url('50', 'true')));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.result.freeSpin).toBe(true);
    expect(body).not.toHaveProperty('account');
    expect(body).not.toHaveProperty('payout');
  });
});
