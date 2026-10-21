import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { headers } from 'next/headers';
import { resolveSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { royalVaultIsolatedPreview, royalVaultOwnerDemoAccess, royalVaultSingleOwnerAllowed } from '@/server/originals/owner-preview-access';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/server/auth/session', () => ({ resolveSession: vi.fn() }));
vi.mock('@/server/db', () => ({getDb:vi.fn()}));

describe('Royal Vault one-account launch gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://betvima.com');
    vi.mocked(getDb).mockReturnValue({
      queryOne: vi.fn().mockResolvedValue({allowed:true}),
    } as never);
    vi.mocked(headers).mockResolvedValue({
      get: (name: string) => name === 'cookie' ? 'session=testing-only' : null,
    } as never);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('does not expose Royal Vault for ordinary unauthenticated production visits', async () => {
    vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
    expect(royalVaultIsolatedPreview()).toBe(false);
    expect(await royalVaultOwnerDemoAccess()).toBe(false);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('exposes only the one active super_admin, not ordinary players or finance staff', async () => {
    for (const role of ['user', 'affiliate', 'finance', 'admin']) {
      vi.mocked(resolveSession).mockResolvedValue({
        user: { id: '00000000-0000-4000-8000-000000000001', role, status: 'active' },
      } as never);
      expect(await royalVaultOwnerDemoAccess()).toBe(false);
    }
    vi.mocked(resolveSession).mockResolvedValue({
      user: { id: '00000000-0000-4000-8000-000000000001', role: 'super_admin', status: 'active' },
    } as never);
    expect(await royalVaultOwnerDemoAccess()).toBe(true);
    expect(resolveSession).toHaveBeenCalled();
  });

  it('fails closed when the database says multiple super admins exist', async () => {
    vi.mocked(getDb).mockReturnValue({
      queryOne: vi.fn().mockResolvedValue({allowed:false}),
    } as never);
    expect(await royalVaultSingleOwnerAllowed({
      id:'00000000-0000-4000-8000-000000000001',
      role:'super_admin', status:'active',
    })).toBe(false);
  });

  it('blocks suspended super admins, offline auth and unsafe environment impersonation', async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      user: { role: 'super_admin', status: 'suspended' },
    } as never);
    expect(await royalVaultOwnerDemoAccess()).toBe(false);
    vi.mocked(resolveSession).mockRejectedValue(new Error('auth offline'));
    expect(await royalVaultOwnerDemoAccess()).toBe(false);
    vi.stubEnv('APP_ENV', 'development');
    expect(await royalVaultOwnerDemoAccess()).toBe(false);
  });

  it('allows only existing isolated preview origin and disables live wallet use there', async () => {
    vi.stubEnv('APP_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.betvima.com');
    expect(royalVaultIsolatedPreview()).toBe(true);
    expect(await royalVaultOwnerDemoAccess()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://betvima.com');
    expect(royalVaultIsolatedPreview()).toBe(false);
    expect(await royalVaultOwnerDemoAccess()).toBe(false);
  });
});
