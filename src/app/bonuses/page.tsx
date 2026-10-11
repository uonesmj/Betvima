'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Gift,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';

const faqs = [
  {
    q: 'How does the 100% deposit bonus work?',
    a: 'Make an eligible deposit and receive a bonus equal to the deposited amount, subject to the applicable promotion rules.',
  },
  {
    q: 'How long is my bonus valid?',
    a: 'Each bonus remains valid for 24 hours from the time it is granted.',
  },
  {
    q: 'Do I need to activate my bonus?',
    a: 'No manual activation is required when an eligible bonus is granted to your account.',
  },
  {
    q: 'Can I make another deposit?',
    a: 'Yes. Each eligible deposit can qualify for the promotion according to the current bonus rules.',
  },
  {
    q: 'What happens after 24 hours?',
    a: 'Any remaining amount expires when the bonus validity period ends.',
  },
];

const benefits = [
  {
    icon: Gift,
    title: '100% Match',
    text: 'Get a bonus equal to your eligible deposit.',
  },
  {
    icon: Clock3,
    title: '24 Hour Window',
    text: 'Your bonus stays active for 24 hours.',
  },
  {
    icon: Zap,
    title: 'Simple & Fast',
    text: 'Deposit, receive your bonus and start playing.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Deposit',
    text: 'Make an eligible deposit through your preferred payment method.',
  },
  {
    number: '02',
    title: 'Get 100%',
    text: 'Your eligible bonus is granted according to the promotion rules.',
  },
  {
    number: '03',
    title: 'Play',
    text: 'Use your bonus within the 24-hour validity period.',
  },
];

export default function BonusesPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <PageShell titleKey="page.bonuses" subtitleKey="page.bonusesSubtitle">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-2 sm:px-6 lg:px-8">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[#091713] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_310px] lg:items-center lg:px-10 lg:py-11">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Exclusive Deposit Bonus
              </div>

              <h1 className="mt-5 max-w-2xl text-[34px] font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">
                Double your deposit.
                <span className="block text-emerald-400">Start with more.</span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Get a <strong className="text-white">100% bonus</strong> on every eligible
                deposit and enjoy your bonus for <strong className="text-white">24 hours</strong>.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/wallet"
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 text-sm font-black text-slate-950 shadow-[0_8px_30px_rgba(52,211,153,0.2)] transition hover:bg-emerald-300"
                >
                  Make a Deposit
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                >
                  See How It Works
                </a>
              </div>
            </div>

            {/* BONUS VISUAL */}
            <div className="mx-auto w-full max-w-[290px]">
              <div className="relative rounded-[26px] border border-white/10 bg-[#0d211d] p-3 shadow-2xl">
                <div className="rounded-[20px] border border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 to-transparent px-5 py-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/20">
                    <Gift className="h-7 w-7" />
                  </div>

                  <div className="mt-5 text-[58px] font-black leading-none tracking-[-0.06em] text-white">
                    100<span className="text-emerald-400">%</span>
                  </div>

                  <div className="mt-2 text-sm font-bold text-slate-300">
                    Deposit Bonus
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs font-bold text-slate-300">
                    <Clock3 className="h-4 w-4 text-emerald-400" />
                    Valid for 24 hours
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/[0.07] bg-[#0c1320] p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="mt-10">
          <div className="mb-5">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Easy to use
            </div>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-white">
              How it works
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Three simple steps. Nothing complicated.
            </p>
          </div>

          <div className="relative grid gap-3 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden border-t border-dashed border-white/10 md:block" />

            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-2xl border border-white/[0.07] bg-[#0c1320] p-5"
              >
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-[#10251f] text-xs font-black text-emerald-400">
                  {step.number}
                </div>
                <h3 className="mt-5 text-base font-black text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HIGHLIGHT */}
        <section className="mt-4 rounded-2xl border border-emerald-400/15 bg-gradient-to-r from-emerald-400/[0.09] via-emerald-400/[0.03] to-transparent p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">A bonus built into your deposit</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Eligible deposits can receive a matching bonus. Check the applicable promotion
                  conditions before playing.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-emerald-400">
              <Check className="h-4 w-4" />
              24-hour validity
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <div className="mb-5">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Need to know
            </div>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c1320]">
            {faqs.map((faq, index) => {
              const open = openFaq === index;

              return (
                <div key={faq.q} className="border-b border-white/[0.06] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="flex w-full items-center justify-between gap-5 px-5 py-[17px] text-left transition hover:bg-white/[0.025] sm:px-6"
                    aria-expanded={open}
                  >
                    <span className="text-sm font-bold leading-5 text-white">
                      {faq.q}
                    </span>

                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition ${open ? 'border-emerald-400/20 text-emerald-400' : 'text-slate-500'}`}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {open && (
                    <div className="px-5 pb-5 pr-14 text-sm leading-6 text-slate-500 sm:px-6 sm:pr-16">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="relative mt-10 overflow-hidden rounded-[24px] border border-emerald-400/20 bg-[#091713] px-5 py-7 text-center sm:px-8 sm:py-9">
          <div className="absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
              <WalletCards className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
              Ready to get your 100% bonus?
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Make your next eligible deposit and get more value from your play.
            </p>

            <Link
              href="/wallet"
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-7 text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/10 transition hover:bg-emerald-300"
            >
              Go to Wallet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-600">
          Bonus availability, eligibility, wagering requirements and limits are subject to the
          applicable promotion terms.
        </p>
      </div>
    </PageShell>
  );
}
