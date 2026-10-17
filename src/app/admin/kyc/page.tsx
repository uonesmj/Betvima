import { AdminShell } from '@/components/admin/admin-shell';
import { KycReviewsClient } from '@/components/admin/kyc-reviews-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Identity reviews · Admin' };
export default function AdminKycPage() {
  return <AdminShell title="Identity verification"><KycReviewsClient /></AdminShell>;
}
