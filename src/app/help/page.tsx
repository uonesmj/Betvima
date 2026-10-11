import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';

export const metadata = { title: 'Help Center' };

const HelpIcon = ({ type }: { type: string }) => {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "account") return <svg {...common}><circle cx="12" cy="7" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>;
  if (type === "payments") return <svg {...common}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6.5 15h4" /></svg>;
  if (type === "betting") return <svg {...common}><path d="M12 2.8l2.4 2.2 3.2-.3.8 3.1 2.7 1.8-1.5 2.8 1.5 2.8-2.7 1.8-.8 3.1-3.2-.3L12 22l-2.4-2.2-3.2.3-.8-3.1-2.7-1.8 1.5-2.8-1.5-2.8 2.7-1.8.8-3.1 3.2.3L12 2.8z" /><path d="M8.5 8.5l3.5 3.5 4-5" /></svg>;
  return <svg {...common}><path d="M20 12.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.5" /><path d="M12 21V7M3 7h18" /><path d="M8.5 7a2.5 2.5 0 1 0 0-5c2 0 3.5 5 3.5 5M15.5 7a2.5 2.5 0 1 0 0-5c-2 0-3.5 5-3.5 5" /></svg>;
};

const categories = [
  { icon: 'account', title: 'Account', text: 'Register, Login, Profile and Account settings.', questions: ['How do I create an account?', 'I cannot log in', 'How do I change my account information?'] },
  { icon: 'payments', title: 'Payments', text: 'Deposits, withdrawals, balance and payment status.', questions: ['How do I make a deposit?', 'Where is my withdrawal?', 'Why is my payment pending?'] },
  { icon: 'betting', title: 'Betting', text: 'Sports, odds, bets, results and early settlement.', questions: ['How are odds and payouts calculated?', 'What happens if a result is changed?', 'How does early settlement work?'] },
  { icon: 'bonus', title: 'Bonuses and VIP', text: 'Bonuses, special offers and the VIP loyalty program.', questions: ['How do bonuses work?', 'How do I view my VIP level?', 'When can my bonus balance be used?'] },
];

const FAQ = [
  { q: 'How is my bet payout calculated?', a: 'Your payout is calculated based on the bet amount and the odds confirmed when the bet was placed. You can view your bet amount, selections, odds and potential payout in My Bets.' },
  { q: 'What happens if an official result is corrected?', a: 'If an official result is changed, the bet is recalculated according to the updated result. Any settlement adjustment is applied to your account and you will be notified.' },
  { q: 'How does early settlement work?', a: 'If early settlement is available for an eligible open bet, you can accept the current settlement amount offered. Each settlement offer can only be accepted once.' },
  { q: 'Why is my deposit or withdrawal pending?', a: 'Processing a payment through the selected payment method may take some time. If the status does not change, contact Online Support and provide your transaction details.' },
  { q: 'How do bonuses work?', a: 'Bonus eligibility and wagering requirements depend on the specific offer. Open the bonus details in your account to view its terms and current status.' },
];

export default function HelpPage() {
  return (
    <PageShell title="Help Center">
      <div className="space-y-6 pb-6">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#101a33] via-[#0b1225] to-[#070b16] p-5 sm:p-7">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-nova-primary/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-nova-primary">Support BETVIMA</div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">How can we help?</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]">Find quick answers to common questions about Account, Payments, Betting, Bonuses and VIP benefits. Need more help? Our Support team is available through online chat.</p>
            <Link href="/support" className="mt-5 inline-flex items-center justify-center rounded-xl bg-nova-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-nova-primary/20 transition hover:opacity-90">Chat with BetVima Support</Link>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Help Topics</h2>
              <p className="mt-1 text-xs leading-5 nova-muted">Choose a topic to find the information you need.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((category) => (
              <div key={category.title} className="nova-card rounded-2xl p-4 transition hover:border-white/15">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-nova-primary"><HelpIcon type={category.icon} /></div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white">{category.title}</h3>
                    <p className="mt-1 text-xs leading-5 nova-muted">{category.text}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
                  {category.questions.map((question) => <div key={question} className="text-xs leading-5 text-slate-300">{question}</div>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-[#111827]">Frequently Asked Questions</h2>
            <p className="mt-1 text-xs leading-5 nova-muted">Answers to some of the most frequently asked questions.</p>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="nova-card overflow-hidden rounded-2xl p-0">
                <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold leading-6 text-white marker:hidden">{item.q}</summary>
                <div className="border-t border-white/5 px-4 pb-4 pt-3 text-sm leading-6 text-slate-300">{item.a}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-nova-primary/20 bg-nova-primary/5 p-5 text-center sm:p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-nova-primary">Online Support 24/7</div>
          <h2 className="mt-2 text-xl font-bold text-[#111827]">Did not find your answer?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Chat with the BetVima Support team. We can help with Account, Payments, Betting and technical issues.</p>
          <Link href="/support" className="mt-5 inline-flex items-center justify-center rounded-xl bg-nova-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-nova-primary/20 transition hover:opacity-90">Open Online Chat</Link>
        </section>
      </div>
    </PageShell>
  );
}
