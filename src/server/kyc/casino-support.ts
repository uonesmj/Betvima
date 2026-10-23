import type { Db } from '@/lib/ports/db';
import { getDb } from '@/server/db';

/**
 * Optional casino-specific support review. Disabled by default.
 * When the operator re-enables it, only a reviewed account may launch NEW
 * real-money sessions. This is NOT itself proof of regulatory KYC completion.
 * Never treat the flag as authorization for legal-age or territory checks.
 */
export function casinoManualReviewRequired(): boolean {
  return process.env.SOFTAGGREGATOR_SUPPORT_REVIEW_REQUIRED === 'true';
}

/** No casino-specific identity step unless the operator opts in later. */
export async function casinoManualReviewSatisfied(
  userId: string, db: Pick<Db, 'queryOne'> = getDb(),
): Promise<boolean> {
  if (!casinoManualReviewRequired()) return true;
  return casinoSupportApproved(userId, db);
}

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
