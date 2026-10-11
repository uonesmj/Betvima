import { PageShell } from '@/components/layout/page-shell';

export const metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy policy" subtitle="What we store and why">
      <article className="nova-card space-y-3 p-5 text-sm leading-7 nova-muted">
        <p><strong className="text-nova-text">Data minimisation.</strong> IP addresses and device strings are never stored in raw form: the platform stores salted hashes used only for fraud and referral-integrity checks.</p>
        <p><strong className="text-nova-text">Payment data.</strong> Card and bank details are handled by the payment provider. Only a masked destination is stored for payouts and support.</p>
        <p><strong className="text-nova-text">Ledger.</strong> Financial records are append-only for legal and audit reasons; a correction is a new entry, never an overwrite.</p>
        <p><strong className="text-nova-text">Your controls.</strong> You can review your profile, limits and verification status in the account area, and request deletion of non-financial personal data subject to regulatory retention.</p>
      </article>
    </PageShell>
  );
}
