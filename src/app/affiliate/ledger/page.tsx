import { AffiliateLedgerClient } from '@/components/account/affiliate-ledger-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Commission ledger' };

export default function AffiliateLedgerPage() {
  return <AffiliateLedgerClient />;
}
