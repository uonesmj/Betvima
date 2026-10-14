import { PageShell } from '@/components/layout/page-shell';

export const metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <PageShell title="Terms of Use" subtitle="A summary of the terms governing betting on this site">
      <article className="nova-card space-y-3 p-5 text-sm leading-7 nova-muted">
        <p><strong className="text-nova-text">Terms of Use.</strong> You must be at least 18 and legally permitted to bet in your jurisdiction. Accounts are personal and non-transferable.</p>
        <p><strong className="text-nova-text">Bets.</strong> A bet is accepted only when the server confirms the stake and odds. Odds in the bet slip are provisional until acceptance; if they change, you must explicitly accept the new odds.</p>
        <p><strong className="text-nova-text">Settlement.</strong> Bets are settled from the authoritative result of each event. If a result is corrected, the previous settlement is reversed and the bet is re-settled - both operations are recorded and visible to you.</p>
        <p><strong className="text-nova-text">Financial matters.</strong> Every balance change is recorded as a ledger transaction and the available balance is updated. Withdrawals are held and verified first; they are marked paid only after an external payment reference is received.</p>
        <p><strong className="text-nova-text">Errors.</strong> Obvious pricing or settlement errors may be corrected with the correction documented; no silent edits are made to settled records.</p>
      </article>
    </PageShell>
  );
}
