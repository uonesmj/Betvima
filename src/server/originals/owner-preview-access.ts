import { headers } from 'next/headers';
import { resolveSession } from '@/server/auth/session';

/**
 * Royal Vault is allowed only on:
 *  1. the existing isolated/no-payments preview environment, or
 *  2. the one authenticated super_admin account in Production.
 *
 * Both branches are PLAY-FOR-FUN. This is not a financial authorisation.
 * There is no real wallet debit/credit route.
 */
export function royalVaultIsolatedPreview(): boolean {
  return process.env.NODE_ENV === 'production' &&
    process.env.APP_ENV === 'test' &&
    process.env.NEXT_PUBLIC_SITE_URL === 'https://preview.betvima.com';
}

export async function royalVaultOwnerDemoAccess(): Promise<boolean> {
  if (royalVaultIsolatedPreview()) return true;
  if (process.env.APP_ENV !== 'production') return false;

  try {
    const incoming = await headers();
    const cookie = incoming.get('cookie') || '';
    if (!cookie) return false;
    const auth = await resolveSession(new Request('https://betvima.com/casino/originals/royal-vault', {
      headers: { cookie },
    }));
    return auth.user?.role === 'super_admin' && auth.user.status === 'active';
  } catch {
    return false;
  }
}
