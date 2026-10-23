import type { Db } from '@/lib/ports/db';
import { getDb } from '@/server/db';

/**
 * Separate support-reviewed casino authorization. This is NOT a claim that
 * document KYC has been completed, nor a substitute for jurisdiction/AML checks.
 * A revoked approval immediately denies NEW casino wagers. Existing owed
 * winnings can still be settled through the financial callback logic.
 */
export const CASINO_SUPPORT_APPROVAL_SQL = `
exists (
  select 1 from nova.casino_support_approvals ca
  where ca.user_id=p.id and ca.status='approved'
    and ca.legal_age_confirmed=true and ca.reviewed_by is not null
)`;

export async function casinoSupportApproved(
  userId: string, db: Pick<Db, 'queryOne'> = getDb(),
): Promise<boolean> {
  try {
    const result = await db.queryOne<{ approved: boolean }>(
      'select ' + CASINO_SUPPORT_APPROVAL_SQL + ' as approved ' +
      'from nova.profiles p where p.id=$1 and p.status=\'active\'', [userId],
    );
    return result?.approved === true;
  } catch {
    // A missing migration, unavailable DB, or revoked review must never
    // silently authorize a wagering session.
    return false;
  }
}
