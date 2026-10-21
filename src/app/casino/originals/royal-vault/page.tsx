import { notFound } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { RoyalVaultGame } from '@/components/casino/royal-vault-game';
import './royal-vault.css';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Royal Vault — BetVima Originals',
  description: 'Royal Vault play-for-fun, five-reel slot preview using virtual credits only.',
};

export default function RoyalVaultPage() {
  // The on/off switch is evaluated server-side, not in the browser.
  // Never expose browser demo mathematics to a real-money wallet endpoint.
  if (process.env.BETVIMA_ORIGINALS_PREVIEW_ENABLED !== 'true') notFound();

  return (
    <PageShell title="Royal Vault" subtitle="BetVima Originals · Play-for-fun">
      <RoyalVaultGame />
    </PageShell>
  );
}
