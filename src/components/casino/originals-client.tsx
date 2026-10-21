'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleHelp, Coins, RotateCcw, Rocket, Dices, Cherry, ShieldCheck } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import {
  DEMO_STARTING_CENTS, SLOT_SYMBOLS, demoCrashMultiplier, demoCrashTargetRandom,
  demoRandomIndex, demoRouletteColor, demoRoulettePayout,
  demoSlotPayout, parseDemoStake, type RoulettePick, type SlotSymbol,
} from '@/lib/original-casino-demo';

type GameTab = 'crash' | 'roulette' | 'slots';
type CrashPhase = 'waiting' | 'running' | 'crashed' | 'cashed';

function fmt(cents: number): string {
  return (cents / 100).toFixed(2);
}

const PICKS: RoulettePick[] = ['red', 'black', 'even', 'odd', 'zero'];

export function BetVimaOriginalsClient() {
  const { locale } = useApp();
  const t = (en: string, fa: string) => locale === 'fa' ? fa : en;
  const [tab, setTab] = useState<GameTab>('crash');
  const [balance, setBalance] = useState(DEMO_STARTING_CENTS);
  const [stake, setStake] = useState('10');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const [crashPhase, setCrashPhase] = useState<CrashPhase>('waiting');
  const [crashMultiplier, setCrashMultiplier] = useState(1);
  const [crashOutcome, setCrashOutcome] = useState<number | null>(null);
  const crashTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const crashActive = useRef(false);
  const crashPoint = useRef(1);
  const crashWager = useRef(0);
  const multiplierRef = useRef(1);
  const crashStartTime = useRef(0);

  const [roulettePick, setRoulettePick] = useState<RoulettePick>('red');
  const [rouletteNumber, setRouletteNumber] = useState<number | null>(null);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rouletteActive = useRef(false);

  const [reels, setReels] = useState<SlotSymbol[]>(['🍒', '🍋', '💎']);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const slotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotActive = useRef(false);

  useEffect(() => () => {
    if (crashTimer.current) clearInterval(crashTimer.current);
    if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
    if (slotTimer.current) clearTimeout(slotTimer.current);
  }, []);

  const anyActive = crashActive.current || rouletteActive.current || slotActive.current;

  function addHistory(entry: string) {
    setHistory((prev) => [entry, ...prev].slice(0, 6));
  }

  function tryStake(): number | null {
    const parsed = parseDemoStake(stake, balance);
    if (parsed === null) {
      setMessage(t('Enter 1–200 demo credits, within your available balance.',
        'بین ۱ تا ۲۰۰ اعتبار آزمایشی و کمتر از موجودی وارد کنید.'));
      return null;
    }
    setMessage('');
    return parsed;
  }

  function startCrash() {
    if (crashActive.current) return;
    const wager = tryStake();
    if (wager === null) return;
    crashActive.current = true;
    crashWager.current = wager;
    crashPoint.current = demoCrashTargetRandom();
    multiplierRef.current = 1;
    setCrashPhase('running');
    setCrashOutcome(null);
    setCrashMultiplier(1);
    setBalance((prev) => prev - wager);
    const startTime = performance.now();
    crashStartTime.current = startTime;
    crashTimer.current = setInterval(() => {
      if (!crashActive.current) return;
      const multiple = demoCrashMultiplier(performance.now() - startTime);
      multiplierRef.current = multiple;
      setCrashMultiplier(multiple);
      if (multiple >= crashPoint.current) {
        crashActive.current = false;
        if (crashTimer.current) clearInterval(crashTimer.current);
        crashTimer.current = null;
        setCrashPhase('crashed');
        setCrashOutcome(crashPoint.current);
        addHistory('CRASH · ' + crashPoint.current.toFixed(2) + '×');
      }
    }, 50);
  }

  function cashOutCrash() {
    if (!crashActive.current) return;
    crashActive.current = false;
    if (crashTimer.current) clearInterval(crashTimer.current);
    crashTimer.current = null;
    const multiple = demoCrashMultiplier(performance.now() - crashStartTime.current);
    multiplierRef.current = multiple;
    setCrashMultiplier(multiple);
    if (multiple >= crashPoint.current) {
      setCrashPhase('crashed');
      setCrashOutcome(crashPoint.current);
      addHistory('CRASH · ' + crashPoint.current.toFixed(2) + '×');
      return;
    }
    const payout = Math.floor(crashWager.current * multiple);
    setBalance((prev) => prev + payout);
    setCrashPhase('cashed');
    setCrashOutcome(multiple);
    addHistory('CRASH · +' + fmt(payout) + ' DEMO');
    setMessage(t('Cashed out: +' + fmt(payout) + ' demo credits.',
      'برد آزمایشی: +' + fmt(payout) + ' اعتبار.'));
  }

  function spinRoulette() {
    if (rouletteActive.current) return;
    const wager = tryStake();
    if (wager === null) return;
    rouletteActive.current = true;
    setRouletteSpinning(true);
    setRouletteNumber(null);
    setBalance((prev) => prev - wager);
    // This is client-side demo randomness. A financial product must use
    // authenticated, audited server-side outcomes and atomic wallet entries.
    const number = demoRandomIndex(37);
    rouletteTimer.current = setTimeout(() => {
      const payout = wager * demoRoulettePayout(number, roulettePick);
      if (payout) setBalance((prev) => prev + payout);
      setRouletteNumber(number);
      setRouletteSpinning(false);
      rouletteActive.current = false;
      addHistory('ROULETTE · ' + number + (payout ? ' · +' + fmt(payout) : ' · 0'));
      setMessage(payout
        ? t('Demo winnings: +' + fmt(payout), 'برد آزمایشی: +' + fmt(payout))
        : t('No win this round.', 'این دور برنده نشدید.'));
    }, 950);
  }

  function spinSlots() {
    if (slotActive.current) return;
    const wager = tryStake();
    if (wager === null) return;
    slotActive.current = true;
    setSlotSpinning(true);
    setBalance((prev) => prev - wager);
    const result = [SLOT_SYMBOLS[demoRandomIndex(SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[demoRandomIndex(SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[demoRandomIndex(SLOT_SYMBOLS.length)]];
    slotTimer.current = setTimeout(() => {
      const multiple = demoSlotPayout(result);
      const payout = Math.floor(wager * multiple);
      setReels(result);
      if (payout) setBalance((prev) => prev + payout);
      slotActive.current = false;
      setSlotSpinning(false);
      addHistory('SLOTS · ' + result.join(' ') + (payout ? ' · +' + fmt(payout) : ' · 0'));
      setMessage(payout
        ? t('Demo winnings: +' + fmt(payout), 'برد آزمایشی: +' + fmt(payout))
        : t('No win this round.', 'این دور برنده نشدید.'));
    }, 850);
  }

  function resetDemo() {
    if (crashActive.current || rouletteActive.current || slotActive.current) return;
    setBalance(DEMO_STARTING_CENTS);
    setHistory([]);
    setMessage('');
    setCrashPhase('waiting');
    setCrashMultiplier(1);
    setCrashOutcome(null);
    setRouletteNumber(null);
    setReels(['🍒', '🍋', '💎']);
  }

  const chart = Array.from({ length: 46 }, (_, i) => {
    const x = i / 45;
    const target = Math.max(1.01, crashMultiplier);
    const y = Math.min(target, Math.exp(x * Math.log(target)));
    return (16 + x * 548).toFixed(1) + ',' + (194 - ((y - 1) / Math.max(1, target - 1)) * 155).toFixed(1);
  }).join(' ');
  const playDisabled = anyActive;

  return (
    <div className="mx-auto w-full max-w-6xl pb-14 text-white" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/casino" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> {t('Back to Casino', 'بازگشت به کازینو')}
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-300">
          <ShieldCheck size={14} /> {t('DEMO ONLY · NO REAL MONEY', 'فقط دمو · بدون پول واقعی')}
        </span>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0B111D] shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-[#18233B] via-[#111929] to-[#132A37] px-5 py-6 sm:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-cyan-400">BETVIMA ORIGINALS</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            {t('Our own casino games', 'بازی‌های اختصاصی بت‌ویما')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {t('An independent prototype, built without a game-provider API. Results and credits are only for demonstration.',
              'نمونه مستقل بدون API شرکت‌های بازی. نتایج و اعتبارها صرفاً آزمایشی هستند.')}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-black/30 px-4 py-3">
              <Coins className="text-cyan-400" size={19} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('Demo balance', 'موجودی دمو')}</p>
                <p className="text-xl font-black tabular-nums">{fmt(balance)} <span className="text-xs text-cyan-400">DEMO</span></p>
              </div>
            </div>
            <button type="button" onClick={resetDemo} disabled={playDisabled}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold hover:bg-white/10 disabled:opacity-40">
              <RotateCcw size={15} /> {t('Reset credits', 'شارژ مجدد دمو')}
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0">
            <nav aria-label="Select a game" className="mb-4 grid grid-cols-3 gap-2">
              {([
                ['crash', Rocket, 'Crash', 'کرش'],
                ['roulette', Dices, 'Roulette', 'رولت'],
                ['slots', Cherry, 'Slots', 'اسلات'],
              ] as const).map(([key, Icon, english, persian]) => (
                <button key={key} type="button" onClick={() => { setTab(key); setMessage(''); }}
                  aria-pressed={tab === key}
                  className={'flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-bold transition sm:text-sm ' +
                    (tab === key ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white')}>
                  <Icon size={17} /> {t(english, persian)}
                </button>
              ))}
            </nav>

            {tab === 'crash' ? (
              <div className="relative flex h-[310px] flex-col justify-center overflow-hidden rounded-[22px] border border-cyan-400/15 bg-[#080F1B] px-4 sm:h-[370px]">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#23415C 1px, transparent 1px),linear-gradient(90deg,#23415C 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
                <svg viewBox="0 0 580 215" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-4/5 w-full opacity-80">
                  <defs>
                    <linearGradient id="crash-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.32"/>
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <polygon points={'16,200 ' + chart + ' 564,200'} fill="url(#crash-gradient)" />
                  <polyline points={chart} fill="none" stroke={crashPhase === 'crashed' ? '#fb7185' : '#22d3ee'}
                    strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="relative z-10 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {crashPhase === 'running' ? t('CASH OUT BEFORE THE CRASH', 'قبل از توقف، برداشت کن')
                      : crashPhase === 'crashed' ? t('CRASHED', 'متوقف شد')
                      : crashPhase === 'cashed' ? t('CASHED OUT', 'برداشت شد')
                      : t('READY FOR TAKEOFF', 'آماده شروع')}
                  </p>
                  <p aria-live="polite" className={'mt-3 text-6xl font-black tabular-nums tracking-tighter sm:text-7xl ' +
                    (crashPhase === 'crashed' ? 'text-rose-400' : 'text-cyan-300')}>
                    {(crashOutcome ?? crashMultiplier).toFixed(2)}×
                  </p>
                  <Rocket size={36} className="mx-auto mt-6 text-cyan-400" />
                </div>
              </div>
            ) : null}

            {tab === 'roulette' ? (
              <div className="flex h-[310px] flex-col items-center justify-center rounded-[22px] border border-white/10 bg-[#080F1B] sm:h-[370px]">
                <div className={'relative flex h-48 w-48 items-center justify-center rounded-full border-[12px] border-[#9B703D] shadow-[0_0_35px_rgba(21,170,146,.13)] sm:h-56 sm:w-56 ' +
                  (rouletteSpinning ? 'animate-spin' : '')}
                  style={{ background: 'repeating-conic-gradient(from -6deg, #0b8059 0deg 9deg, #141D2D 9deg 18deg, #a93a3a 18deg 27deg)' }}>
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-[#D6B07A] bg-[#0D1928] text-center text-5xl font-black tabular-nums shadow-inner sm:h-32 sm:w-32">
                    {rouletteNumber === null ? '–' : rouletteNumber}
                  </div>
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">
                  {rouletteSpinning ? t('Spinning...', 'در حال چرخش...')
                    : rouletteNumber !== null ? t('Result: ', 'نتیجه: ') + rouletteNumber + ' · ' + demoRouletteColor(rouletteNumber).toUpperCase()
                    : t('European wheel · 0–36', 'چرخ اروپایی · ۰ تا ۳۶')}
                </p>
              </div>
            ) : null}

            {tab === 'slots' ? (
              <div className="flex h-[310px] flex-col items-center justify-center rounded-[22px] border border-amber-400/20 bg-[radial-gradient(circle_at_center,#242039,#080F1B_68%)] sm:h-[370px]">
                <p className="mb-6 text-xs font-extrabold uppercase tracking-[.28em] text-amber-300">LUCKY THREE</p>
                <div className="grid w-full max-w-md grid-cols-3 gap-2 px-3 sm:gap-4">
                  {reels.map((symbol, index) => (
                    <div key={index} className={'flex aspect-square items-center justify-center rounded-2xl border-2 border-amber-400/35 bg-[#141D30] text-5xl shadow-lg sm:text-7xl ' +
                      (slotSpinning ? 'animate-pulse' : '')}>{slotSpinning ? '❔' : symbol}</div>
                  ))}
                </div>
                <p className="mt-6 text-xs font-semibold text-slate-400">
                  {t('3 matching symbols pay up to 20×', '۳ نماد یکسان تا ۲۰ برابر جایزه دارد')}
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs leading-5 text-slate-400">
              <CircleHelp size={16} className="mt-0.5 shrink-0 text-cyan-400" />
              <span>{t('This is a browser-based demo. Credits cannot be deposited, transferred, converted to USD or withdrawn. Do not use this outcome logic for money.',
                'این نسخه فقط دمو است. اعتبارها قابل واریز، انتقال، تبدیل به دلار یا برداشت نیستند. نتایج این نسخه برای شرط پول واقعی مناسب نیستند.')}</span>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[18px] border border-white/10 bg-[#141E2F] p-4">
              <p className="text-sm font-extrabold">{t('Demo play', 'بازی آزمایشی')}</p>
              <label htmlFor="originals-stake" className="mt-4 block text-xs font-semibold text-slate-400">
                {t('Stake (demo credits)', 'مبلغ بازی (اعتبار آزمایشی)')}
              </label>
              <input id="originals-stake" inputMode="decimal" value={stake}
                onChange={(event) => setStake(event.target.value)}
                disabled={playDisabled} aria-describedby="originals-stake-limits"
                className="mt-2 h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-base font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-50"/>
              <p id="originals-stake-limits" className="mt-1.5 text-[11px] text-slate-400">
                {t('Min 1 · Max 200 DEMO', 'حداقل ۱ · حداکثر ۲۰۰ دمو')}
              </p>

              {tab === 'roulette' ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400">{t('Select your bet', 'نوع شرط را انتخاب کن')}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {PICKS.map((choice) => (
                      <button key={choice} type="button" disabled={rouletteSpinning}
                        aria-pressed={roulettePick === choice}
                        onClick={() => setRoulettePick(choice)}
                        className={'rounded-lg border px-2 py-3 text-xs font-extrabold capitalize ' +
                          (roulettePick === choice ? 'border-cyan-400 bg-cyan-400/15 text-white' : 'border-white/10 bg-black/20 text-slate-300')}>
                        {choice === 'red' ? t('Red', 'قرمز')
                          : choice === 'black' ? t('Black', 'مشکی')
                          : choice === 'even' ? t('Even', 'زوج')
                          : choice === 'odd' ? t('Odd', 'فرد')
                          : t('Zero 36×', 'صفر ۳۶×')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button type="button"
                onClick={tab === 'crash' ? (crashPhase === 'running' ? cashOutCrash : startCrash)
                  : tab === 'roulette' ? spinRoulette : spinSlots}
                disabled={tab === 'crash' ? (rouletteActive.current || slotActive.current) : playDisabled}
                className={'mt-5 flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ' +
                  (tab === 'crash' && crashPhase === 'running' ? 'bg-amber-400 text-[#17130A] hover:bg-amber-300'
                    : 'bg-cyan-400 text-[#07151B] hover:bg-cyan-300')}>
                {tab === 'crash'
                  ? crashPhase === 'running' ? t('Cash out now', 'برداشت الان') : t('Start crash', 'شروع کرش')
                  : tab === 'roulette' ? rouletteSpinning ? t('Spinning...', 'در حال چرخش...') : t('Spin roulette', 'چرخاندن رولت')
                  : slotSpinning ? t('Spinning...', 'در حال چرخش...') : t('Spin slots', 'چرخاندن اسلات')}
              </button>
              <p aria-live="polite" className="mt-3 min-h-8 text-xs leading-5 text-cyan-200">{message}</p>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-[#141E2F] p-4">
              <h2 className="mb-3 text-sm font-extrabold">{t('Recent demo rounds', 'دورهای اخیر دمو')}</h2>
              {history.length ? (
                <ul className="space-y-2 text-xs text-slate-300">
                  {history.map((entry, index) => (
                    <li key={index} className="rounded-lg bg-black/20 px-3 py-2 font-semibold tabular-nums">{entry}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-5 text-slate-400">
                  {t('No rounds played in this session yet.', 'هنوز در این نشست بازی انجام نشده است.')}
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
