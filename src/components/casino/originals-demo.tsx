'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Dices, LockKeyhole, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import {
  DEMO_REEL_SYMBOLS,
  DEMO_STAKES,
  DEMO_STARTING_CREDITS,
  ORIGINALS_DEMO_GAMES,
  rollDemoDice,
  spinDemoSlots,
  type DiceDirection,
  type DiceRound,
  type SlotRound,
} from '@/lib/originals/demo-engine';

type Outcome = DiceRound | SlotRound;
type RecentRound = { gameId: string; outcome: Outcome; stake: number; award: number };

export function OriginalsDemo() {
  const { locale } = useApp();
  const t = (en: string, fa: string) => locale === 'fa' ? fa : en;
  const [selected, setSelected] = useState(ORIGINALS_DEMO_GAMES[0].id);
  const [credits, setCredits] = useState(DEMO_STARTING_CREDITS);
  const [stake, setStake] = useState<number>(20);
  const [direction, setDirection] = useState<DiceDirection>('under');
  const [last, setLast] = useState<RecentRound | null>(null);
  const [played, setPlayed] = useState(0);
  const [error, setError] = useState('');
  const game = ORIGINALS_DEMO_GAMES.find((item) => item.id === selected) ?? ORIGINALS_DEMO_GAMES[0];

  const chooseGame = (id: string) => {
    setSelected(id);
    setLast(null);
    setError('');
  };

  const reset = () => {
    setCredits(DEMO_STARTING_CREDITS);
    setLast(null);
    setPlayed(0);
    setError('');
  };

  const play = () => {
    if (stake > credits) {
      setError(t('Not enough demo credits. Reset the free balance to continue.', 'اعتبار نمایشی کافی نیست؛ اعتبار آزمایشی را بازنشانی کنید.'));
      return;
    }
    try {
      // Local, non-redeemable points only. Do not add wallet or network calls here.
      const outcome = game.engine === 'slots' ? spinDemoSlots() : rollDemoDice(direction);
      const award = stake * outcome.multiplier;
      setCredits((balance) => balance - stake + award);
      setLast({ gameId: game.id, outcome, stake, award });
      setPlayed((count) => count + 1);
      setError('');
    } catch {
      setError(t('Secure randomness is unavailable on this device.', 'تولید عدد تصادفی امن روی این دستگاه در دسترس نیست.'));
    }
  };

  const currentRound = last?.gameId === game.id ? last : null;

  return (
    <div className="space-y-5 pb-8" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div className="overflow-hidden rounded-[22px] border border-[#293242] bg-[#0B0F17] text-white shadow-[0_12px_36px_rgba(0,0,0,.13)]">
        <div className="relative overflow-hidden border-b border-white/10 px-4 py-6 sm:px-7 sm:py-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-[#1675F8]/20 blur-[60px]" />
          <Link href="/casino" className="relative inline-flex items-center gap-1.5 text-xs font-semibold text-[#B5C4D7] hover:text-white">
            <ArrowLeft size={15} />{t('All casino games', 'بازگشت به کازینو')}
          </Link>
          <div className="relative mt-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2F5F9E] bg-[#122948] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#80B9FF]">
                <Sparkles size={13} />BetVima Originals
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                {t('Built by BetVima', 'ساخته‌شده توسط بت‌ویما')}
              </h2>
              <p className="mt-2 max-w-lg text-xs leading-6 text-[#9FAFC3]">
                {t('A first look at our original game engines. Six demo themes, two experimental mechanics.', 'نگاهی اولیه به موتورهای اختصاصی ما؛ شش ظاهر آزمایشی و دو سازوکار بازی.')}
              </p>
            </div>
            <div className="min-w-[150px] rounded-2xl border border-white/10 bg-white/[.055] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#9FAFC3]">{t('Demo credits', 'اعتبار نمایشی')}</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-white">{credits.toLocaleString('en-US')}</strong>
              <button type="button" onClick={reset} className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#86B9FF] hover:text-white">
                <RotateCcw size={12} />{t('Reset for free', 'بازنشانی رایگان')}
              </button>
            </div>
          </div>
          <div className="relative mt-5 flex items-start gap-2 rounded-xl border border-[#31527B] bg-[#14243B] px-3 py-3 text-[11px] leading-5 text-[#C0D7F3]">
            <LockKeyhole size={16} className="mt-0.5 shrink-0 text-[#8DBFFF]" aria-hidden="true" />
            <span>{t('PLAY-FOR-FUN PROTOTYPE ONLY. No real balance, deposits, winnings or cash withdrawals. These games have not been certified for real-money operation.', 'فقط نمونه آزمایشی بدون پول واقعی. اعتبار این صفحه به کیف پول متصل نیست و امکان واریز، برداشت یا دریافت جایزه نقدی ندارد. این بازی‌ها برای پول واقعی تأیید فنی نشده‌اند.')}</span>
          </div>
        </div>

        <section aria-label={t('Demo game catalogue', 'فهرست بازی‌های آزمایشی')} className="px-3 py-5 sm:px-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">{t('Choose a demo', 'انتخاب بازی آزمایشی')}</h3>
            <span className="text-[11px] text-[#8794A7]">{t('6 themes · 2 engines', '۶ ظاهر · ۲ موتور')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {ORIGINALS_DEMO_GAMES.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseGame(item.id)} aria-pressed={item.id === game.id}
                className={'min-w-0 overflow-hidden rounded-2xl border p-2.5 text-start transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ' +
                  (item.id === game.id ? 'border-[#4495FF] bg-[#172940]' : 'border-white/10 bg-white/[.035] hover:border-[#455875]')}>
                <span className="flex h-16 items-center justify-center rounded-xl bg-[#121B29] text-3xl font-black"
                  style={{ color: item.accent }}>{item.engine === 'slots' ? '7 ✦ 7' : '00–99'}</span>
                <span className="mt-2 block truncate text-[11px] font-extrabold text-white">{item.name}</span>
                <span className="mt-0.5 block text-[10px] text-[#93A3B7]">{item.engine === 'slots' ? t('Slots', 'اسلات') : t('Dice', 'دایس')}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-3 border-t border-white/10 p-3 sm:p-6 lg:grid-cols-[1fr_270px]">
          <section className="min-w-0 rounded-2xl border border-white/10 bg-[#111925] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2"><Dices size={17} className="text-[#7DB5FF]" /><h3 className="text-lg font-black">{game.name}</h3></div>
                <p className="mt-1 text-[11px] text-[#8494A9]">{game.tagline}</p>
              </div>
              <span className="rounded-lg border border-white/10 bg-[#18243A] px-2.5 py-1 text-[10px] font-bold text-[#93BDF4]">{t('DEMO', 'دمو')}</span>
            </div>
            <div aria-live="polite" className="mt-5 flex min-h-[188px] flex-col items-center justify-center rounded-2xl border border-[#2B3850] bg-[radial-gradient(ellipse_at_top,#20395D,#111927_70%)] p-4 sm:min-h-[240px]">
              {game.engine === 'slots' ? (
                <>
                  <div className="flex w-full max-w-[420px] justify-center gap-2 sm:gap-3">
                    {(currentRound?.outcome.kind === 'slots' ? currentRound.outcome.reels : [0, 1, 2]).map((symbol, i) => (
                      <div key={i} className="grid h-[83px] min-w-0 flex-1 place-items-center rounded-2xl border border-[#51617B] bg-[#07101E] text-[40px] font-black shadow-[inset_0_0_18px_rgba(84,146,255,.12)] sm:h-[116px] sm:text-[56px]"
                        style={{ color: game.accent }}>{DEMO_REEL_SYMBOLS[symbol]}</div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] text-[#A6B8D2]">{t('Three identical symbols pay 15×', 'سه نماد یکسان، پرداخت ۱۵ برابر')}</p>
                </>
              ) : (
                <>
                  <div className="text-6xl font-black tabular-nums tracking-tight" style={{ color: game.accent }}>
                    {currentRound?.outcome.kind === 'dice' ? String(currentRound.outcome.number).padStart(2, '0') : '??'}
                  </div>
                  <p className="mt-4 text-xs font-medium text-[#A6B8D2]">{t('Possible results: 00 – 99', 'نتیجه‌های ممکن: ۰۰ تا ۹۹')}</p>
                  <p className="mt-2 text-[11px] text-[#7D91B0]">{t('Win: under 48 or over 51 · 2×', 'برد: کمتر از ۴۸ یا بیشتر از ۵۱ · ۲ برابر')}</p>
                </>
              )}
            </div>
            <div aria-live="polite" className="mt-4 min-h-[46px] rounded-xl border border-white/10 bg-[#0C1420] px-4 py-3 text-center text-xs font-bold text-[#D8E5F8]">
              {currentRound
                ? currentRound.outcome.won
                  ? t('Demo win: +', 'برد نمایشی: +') + currentRound.award.toLocaleString('en-US') + t(' credits', ' اعتبار')
                  : t('No win this round — try another free round.', 'این دور برنده نشدید؛ دور آزمایشی دیگری را امتحان کنید.')
                : t('Select your demo stake and play.', 'مقدار اعتبار آزمایشی را انتخاب کنید و بازی را شروع کنید.')}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111925] p-4">
            <h3 className="text-sm font-extrabold">{t('Demo controls', 'کنترل بازی آزمایشی')}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#94A2B7]">{t('Virtual points only; never your BetVima wallet.', 'فقط امتیاز مجازی؛ بدون ارتباط با کیف پول بت‌ویما.')}</p>
            <p className="mt-6 text-[11px] font-bold text-[#BDCADB]">{t('Stake (demo credits)', 'مقدار بازی (اعتبار مجازی)')}</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {DEMO_STAKES.map((amount) => (
                <button key={amount} type="button" aria-pressed={stake === amount} onClick={() => setStake(amount)}
                  className={'rounded-lg border py-2.5 text-xs font-black tabular-nums ' +
                    (stake === amount ? 'border-[#529AFE] bg-[#17385F] text-white' : 'border-white/10 bg-[#192333] text-[#96A6BE] hover:text-white')}>{amount}</button>
              ))}
            </div>
            {game.engine === 'dice' ? (
              <>
                <p className="mt-5 text-[11px] font-bold text-[#BDCADB]">{t('Predict the roll', 'پیش‌بینی عدد')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['under', 'over'] as const).map((option) => (
                    <button key={option} type="button" onClick={() => setDirection(option)} aria-pressed={direction === option}
                      className={'rounded-xl border px-2 py-3 text-xs font-extrabold ' +
                        (direction === option ? 'border-[#529AFE] bg-[#17385F] text-white' : 'border-white/10 bg-[#192333] text-[#96A6BE]')}>
                      {option === 'under' ? t('Under 48', 'کمتر از ۴۸') : t('Over 51', 'بیشتر از ۵۱')}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <button type="button" onClick={play} disabled={credits < stake} className="mt-5 w-full rounded-xl bg-[#1684FF] px-3 py-4 text-sm font-black text-white transition hover:bg-[#006EE6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:opacity-50">
              {game.engine === 'slots' ? t('Spin demo reels', 'چرخاندن اسلات نمایشی') : t('Roll demo dice', 'انداختن تاس نمایشی')}
            </button>
            {error ? <p role="alert" className="mt-3 text-xs leading-5 text-[#FFB2B2]">{error}</p> : null}
            {credits < stake ? <button type="button" onClick={reset} className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2.5 text-xs font-bold text-white">{t('Restore demo credits', 'بازیابی اعتبار نمایشی')}</button> : null}
            <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px] text-[#A4B1C1]">
              <div className="flex justify-between"><span>{t('Demo rounds', 'تعداد دورهای دمو')}</span><span className="font-bold tabular-nums text-white">{played}</span></div>
              <div className="flex justify-between"><span>{t('Theoretical RTP', 'بازگشت نظری')}</span><span className="font-bold text-white">{game.engine === 'dice' ? '96%' : '93.75%'}</span></div>
              <p className="pt-2 leading-5 text-[#8493A6]">{t('Illustrative math only; this is not a certified real-money game.', 'این ارقام فقط برای نمونه محاسباتی‌اند و گواهی تأیید بازی با پول واقعی نیستند.')}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
