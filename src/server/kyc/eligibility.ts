import { getDb } from '@/server/db';

/** Server-only identity evidence gate; no launch based on UI state or profile flags alone. */
export async function casinoIdentityApproved(userId: string): Promise<boolean> {
  const row = await getDb().queryOne<{
    status: string; age_verified: boolean; kyc_status: string; reviewed: boolean;
  }>(
    "select p.status::text as status,p.age_verified,p.kyc_status::text as kyc_status, " +
    "exists(select 1 from nova.kyc_submissions k where k.user_id=p.id " +
    "and k.status='verified' and k.legal_age_confirmed=true and k.reviewed_by is not null) as reviewed " +
    "from nova.profiles p where p.id=$1", [userId],
  );
  return row?.status === 'active' && row.age_verified === true &&
    row.kyc_status === 'verified' && row.reviewed === true;
}
