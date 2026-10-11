import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';

export const metadata = { title: 'Responsible gaming' };

export default function ResponsibleGamingPage() {
  return (
    <PageShell title="Responsible gaming">
      <div className="nova-card space-y-3 p-5 text-sm leading-7 nova-muted">
        <p>Betting is entertainment, not income. Set limits before you play and never bet money you cannot afford to lose.</p>
        <ul className="list-inside list-disc space-y-1.5">
          <li>Daily and weekly loss limits, deposit limits, stake caps and session timers are available in your account.</li>
          <li>Limits توسط سرور در هر Bet و هر درخواست پرداخت اعمال می‌شوند.</li>
          <li>Self-exclusion immediately blocks betting, deposits and affiliate access for the chosen period.</li>
          <li>If gambling stops being fun, use self-exclusion and seek local support services.</li>
        </ul>
        
        <p className="text-xs">Only persons aged 18 and over. Underage betting is prohibited.</p>
      </div>
    </PageShell>
  );
}
