import { KycClient } from '@/components/account/kyc-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Identity verification · BetVima' };
export default function VerificationPage() {
  return <main className="min-h-dvh bg-[#F2F5F8] px-3 py-6 sm:px-6 sm:py-10"><KycClient /></main>;
}
