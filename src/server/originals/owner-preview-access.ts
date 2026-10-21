import { headers } from 'next/headers';
import { resolveSession } from '@/server/auth/session';
import { getDb } from '@/server/db';

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

export async function royalVaultSingleOwnerAllowed(user: {id: string; role: string; status: string}): Promise<boolean> {
  if (user.role !== 'super_admin' || user.status !== 'active') return false;
  try {
    // Fail closed if a second super_admin is created later.
    // The user identity comes from the verified server session, never input.
    const row = await getDb().queryOne<{allowed: boolean}>(`
      select (
        (select count(*) from nova.profiles where role='super_admin')=1
        and exists (
          select 1 from nova.profiles
          where id=$1 and role='super_admin' and status='active'
        )
      ) as allowed`, [user.id]);
    return row?.allowed === true;
  } catch {
    return false;
  }
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
    return auth.user ? await royalVaultSingleOwnerAllowed(auth.user) : false;
  } catch {
    return false;
  }
}
