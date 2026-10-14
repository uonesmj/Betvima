'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';

const levels = [
  ['Bronze 1', '—', 'bronze'], ['Bronze 2', 'US$5,000', 'bronze'], ['Bronze 3', 'US$10,000', 'bronze'],
  ['Silver 1', 'US$25,000', 'silver'], ['Silver 2', 'US$50,000', 'silver'], ['Silver 3', 'US$100,000', 'silver'],
  ['Gold 1', 'US$250,000', 'gold'], ['Gold 2', 'US$500,000', 'gold'], ['Gold 3', 'US$1,000,000', 'gold'],
  ['Platinum 1', 'US$2,500,000', 'platinum'], ['Platinum 2', 'US$5,000,000', 'platinum'], ['Platinum 3', 'US$10,000,000', 'platinum'],
] as const;

const rewards = ['Cashback', 'Rakeback', 'Access to VIP Club', 'Private tournaments', 'VIP manager', 'Concierge service', 'Bonuses from VIP manager', 'Gifts and exclusive merch', 'Trips to VIP events'];

const faqs = [
  ['How do I know how much I need to bet to reach the next level?', 'Multiply your progress percentage by the turnover amount required to reach the next level, divide the result by 100, then subtract that amount from the required turnover.'],
  ['How can I join the VIP loyalty program?', 'After registration, you automatically receive Bronze Level 1. Continue betting on sports and using markets to increase your turnover and progress through higher levels.'],
  ['What rewards do VIP players receive?', 'Higher levels unlock additional cashback, rakeback, VIP Club access, private tournaments and other exclusive privileges.'],
  ['When do I become a VIP?', 'VIP privileges begin at Gold 3 and continue to expand as you progress through higher levels.'],
];

export function LoyaltyProgramClient() {
  const [open, setOpen] = useState<number | null>(null);
  const { locale } = useApp();
  const tr = (value: string) => locale === 'fa' ? translateVisibleText(value) : value;

  return (
    <main className="mx-auto w-full max-w-[1180px] px-3 pb-8 sm:px-5">
      <section className="relative mb-5 min-h-[300px] overflow-hidden rounded-[22px] bg-[#11151D]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_50%,rgba(0,216,120,.22),transparent_35%),linear-gradient(110deg,#10151E,#151B24)]" />
        <div className="absolute right-[-40px] top-[-50px] h-[330px] w-[330px] rounded-full border border-[#00D878]/20" />
        <div className="absolute right-[45px] top-[35px] h-[240px] w-[240px] rounded-full border border-[#00D878]/10" />
        <div className="relative z-10 flex min-h-[300px] items-center px-6 py-10 sm:px-12">
          <div className="max-w-[560px]">
            <span className="mb-4 inline-flex rounded-full bg-[#00D878]/10 px-3 py-1.5 text-xs font-bold text-[#00D878]">{tr('VIP LOYALTY')}</span>
            <h1 className="text-[32px] font-black tracking-[-1px] text-white sm:text-[48px]">{tr('VIP Loyalty Program')}</h1>
            <p className="mt-3 text-[18px] text-[#AAB3C1]">{tr("Higher level —")} <span className="text-white">{tr('bigger rewards')}</span></p>
            <a href="/account/profile" className="mt-7 inline-flex h-12 items-center rounded-xl bg-[#00D878] px-7 text-sm font-extrabold text-[#07130E]">{tr('Participate')}</a>
          </div>
          <div className="pointer-events-none absolute bottom-0 right-[-15px] hidden w-[48%] sm:block">
            <img src="/brand/loyalty/vip-club-fg.png" alt="" className="ml-auto max-h-[285px] w-auto object-contain" />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-[22px] bg-[#0B1018] p-5 sm:p-7">
        <h2 className="mb-5 text-[24px] font-black text-white">{tr('How it works')}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Step 1', 'Registration', 'You receive Bronze Level 1 immediately'],
            ['Step 2', 'Climb the levels', 'You’ll earn more bonuses at every new level. Play casino, place sports bets and use Markets.'],
            ['Step 3', 'Become a VIP', "You'll get exclusive privileges at Gold 3"],
          ].map(([step, title, text]) => (
            <div key={step} className="relative min-h-[170px] overflow-hidden rounded-[18px] border border-[#202936] bg-[#141A24] p-5">
              <span className="inline-flex rounded-lg bg-[#242C38] px-3 py-1.5 text-xs font-bold text-[#B7C0CD]">{tr(step)}</span>
              <h3 className="mt-5 text-[20px] font-black text-white">{tr(title)}</h3>
              <p className="mt-2 max-w-[320px] text-sm leading-6 text-[#8F9AAA]">{tr(text)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-[22px] bg-[#0B1018] p-5 sm:p-7">
        <h2 className="mb-5 text-[24px] font-black text-white">{tr('Levels and Rewards')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {levels.map(([name, turnover, image]) => (
            <div key={name} className="overflow-hidden rounded-[18px] border border-[#252D39] bg-[#141A24]">
              <div className="relative h-[145px] overflow-hidden">
                <img src={`/brand/loyalty/${image}.png`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#141A24] via-transparent to-transparent" />
                <h3 className="absolute bottom-3 left-4 text-[17px] font-black text-white">{tr(name)}</h3>
              </div>
              <div className="px-4 pb-4 pt-2">
                <p className="text-[11px] uppercase tracking-wide text-[#788494]">{tr('Turnover amount')}</p>
                <p className="mt-1 text-[15px] font-extrabold text-white">{turnover}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((reward, i) => (
            <div key={reward} className="flex items-center gap-3 rounded-xl bg-[#141A24] px-4 py-3 text-sm text-[#D5DAE2]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00D878]/15 text-xs font-black text-[#00D878]">{i < 2 ? '✓' : '◆'}</span>
              {tr(reward)}
            </div>
          ))}
        </div>
      </section>

      <section className="relative mb-6 min-h-[230px] overflow-hidden rounded-[22px] bg-[#101821]">
        <img src="/brand/loyalty/vip-club-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <img src="/brand/loyalty/vip-club-fg.png" alt="" className="absolute bottom-0 right-[-20px] hidden h-[210px] w-auto object-contain sm:block" />
        <div className="relative z-10 max-w-[560px] px-6 py-10 sm:px-10">
          <h2 className="text-[28px] font-black text-white">{tr('Join VIP Club')}</h2>
          <p className="mt-2 text-[#A7B1BE]">{tr('Reach Gold 3 and unlock unique VIP privileges')}</p>
          <a href="/account/profile" className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#00D878] px-6 text-sm font-extrabold text-[#07130E]">{tr('Learn more')}</a>
        </div>
      </section>

      <section className="rounded-[22px] bg-[#0B1018] p-5 sm:p-7">
        <h2 className="mb-5 text-[24px] font-black text-white">{tr('Questions & Answers')}</h2>
        <div className="overflow-hidden rounded-[16px] border border-[#252D39]">
          {faqs.map(([question, answer], i) => (
            <div key={question} className="border-b border-[#252D39] last:border-0">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-4 py-5 text-left text-sm font-bold text-white sm:px-5">
                <span>{tr(question)}</span><span className="text-xl text-[#8B96A5]">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <div className="px-4 pb-5 text-sm leading-6 text-[#929DAC] sm:px-5">{tr(answer)}</div>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
