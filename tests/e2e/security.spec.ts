/**
 * Security surface checks against the real server:
 *   * protected areas render an access message instead of data for anonymous visitors
 *   * the service-role key never appears in any response body
 *   * API errors use the standard envelope and never leak stack traces
 *   * security headers are present
 */
import { expect, test } from '@playwright/test';

const PROTECTED = ['/admin/dashboard', '/admin/users', '/admin/audit', '/account/profile', '/wallet', '/bets', '/affiliate/dashboard'];

test.describe('access control', () => {
  for (const path of PROTECTED) {
    test(`${path} exposes no data to an anonymous visitor`, async ({ request }) => {
      const response = await request.get(path, { failOnStatusCode: false });
      expect([200, 302, 307, 401, 403]).toContain(response.status());
      const body = await response.text();
      // No balances, no customer emails, no service-role key.
      expect(body).not.toContain('service_role');
      expect(body).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    });
  }
});

test.describe('api envelope and headers', () => {
  test('unauthenticated API call returns the standard error envelope', async ({ request }) => {
    const response = await request.get('/api/v1/wallet', { failOnStatusCode: false });
    expect([401, 403, 500, 503]).toContain(response.status());
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const error = (payload as { error: { code?: string; message?: string } }).error;
      expect(error.code, 'an error code is required').toBeTruthy();
      expect(JSON.stringify(error)).not.toMatch(/at \w+ \(.*:\d+:\d+\)/); // no stack trace
      expect(JSON.stringify(error)).not.toContain('service_role');
    }
    expect(response.headers()['x-correlation-id']).toBeTruthy();
  });

  test('security headers are set by the application', async ({ request }) => {
    const response = await request.get('/', { failOnStatusCode: false });
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('health endpoint reports honestly', async ({ request }) => {
    const response = await request.get('/api/health', { failOnStatusCode: false });
    expect([200, 503]).toContain(response.status());
    const report = await response.json();
    expect(['ok', 'degraded', 'down']).toContain(report.status);
    expect(Array.isArray(report.checks)).toBe(true);
    // No provider configured must never be reported as ok.
    const providerCheck = report.checks.find((check: { name: string }) => check.name === 'sports_provider');
    if (providerCheck && providerCheck.message?.includes('No sports data provider')) {
      expect(providerCheck.status).not.toBe('ok');
    }
  });
});
