import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { RoyalVaultGame } from '@/components/casino/royal-vault-game';
import { royalVaultOwnerDemoAccess } from '@/server/originals/owner-preview-access';
import './royal-vault.css';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Royal Vault — BetVima Originals',
  description: 'Royal Vault play-for-fun, five-reel slot preview using virtual credits only.',
};

export default async function RoyalVaultPage() {
  // Isolated preview, or the single signed-in production super admin.
  // Never authorize any real-money cash transfer from this page.
  if (!await royalVaultOwnerDemoAccess()) notFound();

  return (
    <PageShell title="Royal Vault" subtitle="BetVima Originals · Play-for-fun">
      <RoyalVaultGame />
    </PageShell>
  );
}
