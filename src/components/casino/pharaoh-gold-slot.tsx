'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Award, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Coins, Expand,
  FastForward, History, Info, Minus, Music2, Pause, Play, Plus, RotateCcw,
  Settings2, ShieldCheck, Sparkles, Volume2, VolumeX, X,
} from 'lucide-react';
import { PharaohAudio, type PharaohSound } from '@/lib/casino/pharaoh-audio';
import { PharaohDepth } from './pharaoh-depth';
import {
  DEMO_START_CENTS, MAX_BET_CENTS, MIN_BET_CENTS, PAYLINES, PAYTABLE, SYMBOL_LABELS, parseDemoBalance,
  type ReelGrid, type SpinResult, type SymbolId,
} from '@/lib/casino/pharaoh-gold';
import styles from './pharaoh-gold.module.css';

type Modal = null | 'paytable' | 'history' | 'settings' | 'auto' | 'bonus' | 'buy';
type Lang = 'en' | 'fa';
const BET_STEPS = [10,20,50,100,200,500,1000,2000,5000,10000] as const;
const INITIAL_REELS: ReelGrid = [
  ['scarab','pharaoh','ankh'],['queen','wild','lotus'],['anubis','eye','scarab'],
  ['lotus','pharaoh','queen'],['eye','scatter','anubis'],
];
const EN = {
  demo: 'DEMO · No real-money wagers', play: 'PLAY DEMO', ready: 'Ready to uncover the treasures?',
  balance: 'DEMO BALANCE', bet: 'TOTAL BET', win: 'LAST WIN', spin: 'SPIN',
  stop: 'QUICK STOP', auto: 'AUTO SPIN', turbo: 'TURBO', buy: 'BUY BONUS',
  wallet: 'PLAY CREDITS', lines: '20 FIXED PAYLINES', settings: 'SETTINGS',
  info: 'PAYTABLE & RULES', history: 'SPIN HISTORY', free: 'FREE SPINS',
  minimum: 'Minimum bet $0.10 USD', usd: 'All casino amounts shown in USD',
  winTitle: 'GOLDEN WIN!', big: 'MEGA TREASURE!', noFunds: 'Not enough demo credits. Reset your balance in Settings.',
  error: 'Spin could not be completed. No demo credits were deducted.',
  autoTitle: 'Auto Spin', autoHint: 'Choose a limited number of automatic spins. You can stop at any time.',
  bonusTitle: 'FREE SPINS UNLOCKED', bonusHint: 'Your treasure awaits. Free spins cost no demo credits.',
  buyTitle: 'Bonus purchase unavailable', buyHint: 'Bonus-buy pricing and mathematics require independent certification before activation.',
  payTitle: 'Paytable & game rules', historyTitle: 'Recent demo spins', settingsTitle: 'Game settings',
  reset: 'RESET DEMO CREDITS', noHistory: 'No rounds played yet', sound: 'Sound effects', music: 'Ambient soundtrack',
  reduce: 'Reduce motion', close: 'CLOSE', resume: 'CONTINUE', cancel: 'CANCEL', awarded: 'AWARDED',
  paid: 'PAID SPIN', freeRound: 'FREE SPIN', rules: '5 reels × 3 rows · 20 fixed lines · Wild substitutes for regular symbols. Three or more Scatters unlock eight free spins; four unlock twelve, and five unlock twenty. Free spins double line awards. Line wins pay left to right.',
  note: 'Demo mathematics only. Outcomes are generated server-side, but this game has not been RTP certified and never touches your real wallet.',
  max: 'MAX BET', quit: 'BACK TO CASINO', activate: 'START', amount: 'USD', noBuy: 'NOT AVAILABLE IN DEMO',
};
const FA: typeof EN = {
  demo: 'نسخه آزمایشی · بدون پول واقعی',play:'بازی آزمایشی',ready:'آماده کشف گنج‌های فرعون هستید؟',
  balance:'موجودی آزمایشی',bet:'مبلغ شرط',win:'آخرین برد',spin:'چرخش',
  stop:'توقف سریع',auto:'چرخش خودکار',turbo:'توربو',buy:'خرید بونوس',
  wallet:'اعتبار آزمایشی',lines:'۲۰ خط پرداخت ثابت',settings:'تنظیمات',
  info:'جدول جوایز و قوانین',history:'تاریخچه چرخش',free:'چرخش رایگان',
  minimum:'حداقل شرط ۰٫۱۰ دلار',usd:'تمام مبالغ کازینو به دلار آمریکا است',
  winTitle:'برد طلایی!',big:'گنج بزرگ!',noFunds:'اعتبار آزمایشی کافی نیست. موجودی را در تنظیمات بازنشانی کنید.',
  error:'چرخش انجام نشد؛ مبلغی از اعتبار آزمایشی کم نشد.',
  autoTitle:'چرخش خودکار',autoHint:'تعداد مشخصی چرخش انتخاب کنید؛ هر زمان می‌توانید متوقف کنید.',
  bonusTitle:'چرخش رایگان فعال شد',bonusHint:'چرخش‌های رایگان از اعتبار شما کم نمی‌کنند.',
  buyTitle:'خرید بونوس غیرفعال است',buyHint:'فعال‌سازی خرید بونوس نیازمند تأیید مستقل محاسبات و جدول پرداخت است.',
  payTitle:'جوایز و قوانین',historyTitle:'تاریخچه آزمایشی',settingsTitle:'تنظیمات بازی',
  reset:'بازنشانی اعتبار',noHistory:'هنوز چرخشی ثبت نشده است',sound:'افکت‌های صوتی',music:'موسیقی زمینه',
  reduce:'کاهش حرکت',close:'بستن',resume:'ادامه',cancel:'انصراف',awarded:'اهدایی',
  paid:'چرخش عادی',freeRound:'چرخش رایگان',rules:'۵ ریل × ۳ ردیف، ۲۰ خط ثابت. وایلد جایگزین نمادهای معمولی است. ۳ اسکتر ۸ چرخش رایگان، ۴ اسکتر ۱۲ چرخش و ۵ اسکتر ۲۰ چرخش فعال می‌کند. جایزه خطی چرخش رایگان دوبرابر است. پرداخت‌ها از چپ به راست است.',
  note:'محاسبات صرفاً آزمایشی است؛ نتیجه در سرور تولید می‌شود، ولی RTP این بازی تأیید نشده و هیچ تراکنشی با کیف پول واقعی انجام نمی‌دهد.',
  max:'حداکثر شرط',quit:'بازگشت به کازینو',activate:'شروع',amount:'USD',noBuy:'در حالت آزمایشی غیرفعال',
};
function cash(cents: number) { return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function BadgeArt({symbol}: {symbol: SymbolId}) {
  return (
    <svg viewBox="0 0 100 100" aria-label={SYMBOL_LABELS[symbol]} role="img" className={styles.symbolArt}>
      <use href={'/casino/pharaoh-gold/symbols.svg#' + symbol} />
    </svg>
  );
}
function resultBonusLabel(result: SpinResult | null): string {
  return result ? result.freeSpinsAwarded + ' FREE SPINS' : 'FREE SPINS';
}
const SPIN_SEQUENCE: SymbolId[] = [
  'ankh', 'queen', 'scarab', 'eye', 'anubis', 'lotus',
  'pharaoh', 'wild', 'scatter', 'ankh', 'queen', 'scarab',
];

/** Rendered motion is decorative. The server determines each result before reveal. */
function RollingReel({ column }: { column: number }) {
  const sequence = Array.from({length: 12}, (_, index) => SPIN_SEQUENCE[(index + column * 3) % 9]!);
  return <div className={styles.spinViewport} aria-hidden="true">
    <div className={styles.spinStrip} style={{animationDuration:(.51 + column * .075) + 's'}}>
      {sequence.map((symbol,index) => <div className={styles.spinTile} key={column+'-'+index}>
        <BadgeArt symbol={symbol}/>
      </div>)}
    </div>
  </div>;
}
function CountUpCents({ cents, reduced }: { cents: number; reduced: boolean }) {
  const [display,setDisplay] = useState(cents);
  useEffect(() => {
    if (reduced || cents <= 0) { setDisplay(cents); return; }
    let frame = 0;
    const start = performance.now();
    const animate = (stamp: number) => {
      const elapsed = Math.min(1,(stamp - start)/850);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(cents * eased));
      if (elapsed < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  },[cents,reduced]);
  return <>{cash(display)}</>;
}

export function PharaohGoldSlot() {
  const [lang,setLang] = useState<Lang>('en');
  const t = lang === 'fa' ? FA : EN;
  const [reels,setReels] = useState<ReelGrid>(INITIAL_REELS);
  const [betCents,setBetCents] = useState(20);
  const [balanceCents,setBalanceCents] = useState(DEMO_START_CENTS);
  const [creditsReady,setCreditsReady] = useState(false);
  const [freeSpins,setFreeSpins] = useState(0);
  const [phase,setPhase] = useState<'idle'|'spinning'|'result'>('idle');
  const [lastSpin,setLastSpin] = useState<SpinResult | null>(null);
  const [rounds,setRounds] = useState<SpinResult[]>([]);
  const [modal,setModal] = useState<Modal>(null);
  const [notice,setNotice] = useState<string>('');
  const [turbo,setTurbo] = useState(false);
  const [reduceMotion,setReduceMotion] = useState(false);
  const [soundOn,setSoundOn] = useState(true);
  const [musicOn,setMusicOn] = useState(false);
  const [soundVolume,setSoundVolume] = useState(.42);
  const [musicVolume,setMusicVolume] = useState(.11);
  const [autoRemaining,setAutoRemaining] = useState(0);
  const [activeRound,setActiveRound] = useState('');
  const [settledCount,setSettledCount] = useState(5);
  const [celebration,setCelebration] = useState<'win'|'big'|'bonus'|null>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<PharaohAudio | null>(null);
  const spinningRef = useRef(false);
  const quickStopRef = useRef(false);
  const mountedRef = useRef(true);
  const lastCallRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    audioRef.current = new PharaohAudio();
    try {
      // V2 clears incorrect V1 balances caused by Number(null) === 0.
      const raw = window.localStorage.getItem('betvima:pharaoh:demo-balance:v2');
      setBalanceCents(parseDemoBalance(raw));
    } catch { /* storage unavailable: use the in-memory demo bankroll */ }
    setCreditsReady(true);
    return () => {
      mountedRef.current = false;
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!creditsReady) return;
    try { window.localStorage.setItem('betvima:pharaoh:demo-balance:v2', String(balanceCents)); } catch { /* storage unavailable */ }
  }, [balanceCents, creditsReady]);
  useEffect(() => { audioRef.current?.setSoundVolume(soundOn ? soundVolume : 0); }, [soundOn,soundVolume]);
  useEffect(() => { audioRef.current?.setMusicVolume(musicVolume); if (musicOn) audioRef.current?.startMusic(); else audioRef.current?.stopMusic(); }, [musicOn,musicVolume]);

  const sfx = useCallback((name: PharaohSound) => { if (soundOn) audioRef.current?.play(name); }, [soundOn]);
  const changeBet = (delta: number) => {
    if (phase !== 'idle' || freeSpins > 0) return;
    const index = BET_STEPS.findIndex(value => value === betCents);
    const next = Math.max(0,Math.min(BET_STEPS.length - 1, index + delta));
    setBetCents(BET_STEPS[next]!); setNotice(''); sfx('tap');
  };
  const handleSpin = useCallback(async () => {
    if (spinningRef.current) { quickStopRef.current = true; return; }
    if (modal || !creditsReady) return;
    if (freeSpins === 0 && balanceCents < betCents) {
      setNotice(t.noFunds);setAutoRemaining(0);sfx('error');return;
    }
    if (Date.now() - lastCallRef.current < 150) return;
    lastCallRef.current = Date.now();
    spinningRef.current = true;
    quickStopRef.current = false;
    setPhase('spinning');
    setSettledCount(0);
    setCelebration(null);
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    setNotice('');
    setActiveRound('');
    sfx('spin');
    const isBonus = freeSpins > 0;
    try {
      // Read-only demo RNG. Preview deliberately rejects POST for every user-facing route.
      const params = new URLSearchParams({betCents:String(betCents),freeSpin:String(isBonus),nonce:crypto.randomUUID()});
      const response = await fetch('/api/v1/casino/demo/pharaoh-gold?' + params, {
        method:'GET', cache:'no-store', credentials:'same-origin', headers:{'Accept':'application/json'},
      });
      if (!response.ok) throw new Error('Spin unavailable');
      const packet: {mode?:string;currency?:string;result?:SpinResult} = await response.json();
      if (packet.mode !== 'demo' || packet.currency !== 'USD' || !packet.result)
        throw new Error('Invalid demo response');
      const result = packet.result;
      if (result.betCents !== betCents || !Array.isArray(result.reels) || result.reels.length !== 5 || !Number.isSafeInteger(result.winCents))
        throw new Error('Invalid spin response');
      const minWait = reduceMotion ? 70 : turbo ? 440 : 1350;
      const until = Date.now() + minWait;
      while (Date.now() < until && !quickStopRef.current) {
        await new Promise(resolve => setTimeout(resolve, Math.min(50, Math.max(0, until - Date.now()))));
      }
      if (!mountedRef.current) return;
      for (let column = 0; column < 5; column++) {
        const completedReel = result.reels[column]!;
        setReels(previous => previous.map((symbols,index) =>
          index === column ? completedReel : symbols));
        setSettledCount(column + 1);
        sfx('reel');
        await new Promise(resolve => setTimeout(resolve,
          reduceMotion || quickStopRef.current ? 40 : turbo ? 90 : 195));
        if (!mountedRef.current) return;
      }
      setLastSpin(result);
      setActiveRound(result.roundId);
      setBalanceCents(balance => balance - (isBonus ? 0 : betCents) + result.winCents);
      setFreeSpins(current => Math.max(0, current - (isBonus ? 1 : 0)) + result.freeSpinsAwarded);
      setRounds(current => [result,...current].slice(0,40));
      setPhase('result');
      const winEffect = result.freeSpinsAwarded > 0 ? 'bonus' :
        result.winCents >= betCents * 20 ? 'big' : result.winCents > 0 ? 'win' : null;
      setCelebration(winEffect);
      if (winEffect) celebrationTimer.current = setTimeout(() => {
        if (mountedRef.current) setCelebration(null);
      }, reduceMotion ? 1200 : 3000);
      if (result.freeSpinsAwarded > 0) {
        sfx('bonus');
        setAutoRemaining(0);
        setModal('bonus');
      } else if (result.winCents >= betCents * 20) sfx('big');
      else if (result.winCents > 0) sfx('win');
      else sfx('stop');
      await new Promise(resolve => setTimeout(resolve,reduceMotion ? 80 : 400));
    } catch {
      if (mountedRef.current) {
        setNotice(t.error);
        setSettledCount(5);
        setAutoRemaining(0);
        sfx('error');
      }
    } finally {
      spinningRef.current = false;
      quickStopRef.current = false;
      if (mountedRef.current) {setPhase('idle');setSettledCount(5);}
    }
  }, [balanceCents,betCents,creditsReady,freeSpins,modal,reduceMotion,t.error,t.noFunds,turbo,sfx]);

  useEffect(() => {
    if (autoRemaining < 1 || phase !== 'idle' || modal || spinningRef.current || !creditsReady) return;
    const id = window.setTimeout(() => {
      setAutoRemaining(n => Math.max(0,n - 1));
      void handleSpin();
    }, turbo ? 260 : 900);
    return () => clearTimeout(id);
  }, [autoRemaining,phase,modal,turbo,handleSpin,creditsReady]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setModal(null);setAutoRemaining(0); }
      if (event.code === 'Space' && !event.repeat && !modal && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault(); void handleSpin();
      }
    };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [handleSpin,modal]);

  const winningCells = new Set<string>();
  if (phase !== 'spinning' && lastSpin?.roundId === activeRound) {
    lastSpin.wins.forEach(win => {
      PAYLINES[win.line - 1]!.forEach((row,col) => {if (col < win.count) winningCells.add(col + '-' + row);});
    });
  }
  const spinBusy = phase === 'spinning';
  const uiDisabled = spinBusy || freeSpins > 0;
  const hitWin = lastSpin && lastSpin.winCents > 0 && phase !== 'spinning';
  return (
    <div className={styles.page} dir="ltr" data-reduced-motion={reduceMotion ? 'true' : 'false'}>
      <div className={styles.stars} aria-hidden="true"/>
      <PharaohDepth disabled={reduceMotion} />
      <header className={styles.topbar}>
        <Link href="/casino" className={styles.back}><ArrowLeft size={18}/><span>{t.quit}</span></Link>
        <div className={styles.brand}><img src="/brand/betvima-logo-transparent.png" alt="BetVima"/></div>
        <div className={styles.topActions}>
          <span className={styles.demoFlag}><ShieldCheck size={14}/>{t.demo}</span>
          <button onClick={() => {setLang(value => value === 'en' ? 'fa' : 'en');sfx('tap');}} className={styles.iconBtn} type="button" aria-label="Switch language">{lang === 'en'?'FA':'EN'}</button>
          <button onClick={() => setModal('settings')} className={styles.iconBtn} type="button" aria-label={t.settings}><Settings2 size={19}/></button>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.titleRow}>
          <div className={styles.templeGuardianLeft} aria-hidden="true"><img src="/casino/pharaoh-gold/guardian.svg" alt=""/></div>
          <div className={styles.templeGuardianRight} aria-hidden="true"><img src="/casino/pharaoh-gold/guardian.svg" alt=""/></div>
          <div className={styles.subtitle}><span className={styles.diamond}>◆</span> ORIGINAL BETVIMA CASINO <span className={styles.diamond}>◆</span></div>
          <img className={styles.gameLogo} src="/casino/pharaoh-gold/logo.svg" alt="Pharaoh Gold"/>
          <p className={styles.currencyAlert}>{t.usd} <span>•</span> {t.minimum}</p>
        </div>

        <section className={styles.machine} aria-label="Pharaoh Gold demo slot machine" data-impact={spinBusy && settledCount > 0 ? 'true' : 'false'}>
          <div className={styles.machineOrnament} aria-hidden="true">
            <img src="/casino/pharaoh-gold/winged-crest.svg" alt=""/>
          </div>
          <div className={styles.templeLightLeft} aria-hidden="true" />
          <div className={styles.templeLightRight} aria-hidden="true" />
          <div className={styles.reelPanel}>
            <div className={styles.reelGrid} aria-live="off">
              {reels.map((reel,col) => {
                const isSpinning = spinBusy && col >= settledCount;
                const justLanded = spinBusy && col === settledCount - 1;
                return <div className={styles.reelColumn} key={col} data-spinning={isSpinning ? 'true':'false'} data-landed={justLanded ? 'true':'false'}>
                  {isSpinning ? <RollingReel column={col}/> : reel.map((symbol,row) =>
                    <div className={styles.symbolCell} key={col+'-'+row} data-win={winningCells.has(col+'-'+row) ? 'true':'false'}>
                      <span className={styles.cellInner}><BadgeArt symbol={symbol}/></span>
                      {winningCells.has(col+'-'+row) && !spinBusy ? <span className={styles.cellGlow} aria-hidden="true"/> : null}
                    </div>)}
                </div>;
              })}
            </div>
            <div className={styles.sideOrnaments} aria-hidden="true"><span>✶</span><span>✶</span><span>✶</span></div>
          </div>
          <div className={styles.machineFoot}>
            <span><Sparkles size={14}/>{t.lines}</span>
            <span>{freeSpins > 0 ? t.free + ': ' + freeSpins : t.ready}</span>
            <span>USD · $0.10 MIN</span>
          </div>
        </section>

        <section className={styles.winDisplay} aria-live="polite">
          {celebration && <div className={styles.celebration} data-kind={celebration} aria-live="polite">
            <div className={styles.celebrationFlare} aria-hidden="true" />
            <div className={styles.celebrationCoins} aria-hidden="true">
              {Array.from({length:14},(_,index) => <span key={index} style={{'--coin-angle':(index*25.714)+'deg','--coin-delay':(index%5*0.08)+'s'} as React.CSSProperties}>✦</span>)}
            </div>
            <div className={styles.celebrationTitle}>{celebration === 'bonus'?t.bonusTitle:celebration === 'big'?t.big:t.winTitle}</div>
            <div className={styles.celebrationAmount}>{celebration === 'bonus' ? resultBonusLabel(lastSpin) : <CountUpCents cents={lastSpin?.winCents ?? 0} reduced={reduceMotion}/>}</div>
          </div>}
          <div className={styles.winning} data-active={hitWin ? 'true' : 'false'}>
            <Award size={21}/>
            {hitWin ? (lastSpin!.winCents >= betCents * 20 ? t.big : t.winTitle) : 'PHARAOH GOLD'}
            <strong><CountUpCents cents={phase === 'spinning' ? 0 : (lastSpin?.winCents ?? 0)} reduced={reduceMotion}/></strong>
          </div>
          {notice && <p role="alert" className={styles.error}>{notice}</p>}
        </section>

        <section className={styles.controlDeck} aria-label="Game controls">
          <div className={styles.metrics}>
            <div className={styles.metric}><span><Coins size={15}/>{t.balance}</span><strong>{cash(balanceCents)}</strong><small>USD • DEMO</small></div>
            <div className={styles.metric}><span><Award size={15}/>{t.win}</span><strong>{cash(phase === 'spinning' ? 0 : (lastSpin?.winCents ?? 0))}</strong><small>USD</small></div>
          </div>
          <div className={styles.betBox}>
            <span className={styles.betTitle}>{t.bet} <b>USD</b></span>
            <div className={styles.betRow}>
              <button type="button" onClick={() => changeBet(-1)} aria-label="Decrease bet" disabled={uiDisabled || !creditsReady || betCents <= MIN_BET_CENTS}><Minus size={20}/></button>
              <strong aria-live="polite">{cash(betCents)}</strong>
              <button type="button" onClick={() => changeBet(1)} aria-label="Increase bet" disabled={uiDisabled || !creditsReady || betCents >= MAX_BET_CENTS}><Plus size={20}/></button>
            </div>
            <div className={styles.betShortcuts}>
              {[10,50,100,500].map(value => <button type="button" key={value} disabled={uiDisabled || !creditsReady} data-active={betCents === value} onClick={() => {setBetCents(value);setNotice('');sfx('tap');}}>{cash(value)}</button>)}
              <button type="button" disabled={uiDisabled || !creditsReady} onClick={() => {setBetCents(MAX_BET_CENTS);setNotice('');sfx('tap');}}>{t.max}</button>
            </div>
          </div>
          <div className={styles.spinGroup}>
            <div className={styles.spinGuardians} aria-hidden="true"><img src="/casino/pharaoh-gold/guardian.svg" alt=""/><img src="/casino/pharaoh-gold/guardian.svg" alt=""/></div>
            <div className={styles.spinHalo} aria-hidden="true" />
            <button type="button" aria-label={spinBusy ? t.stop : t.spin} disabled={!creditsReady} onClick={() => {void handleSpin();}} className={styles.spinButton} data-busy={spinBusy} >
              {spinBusy ? <FastForward size={30}/> : <RotateCcw size={36} strokeWidth={2.4}/>}
              <span>{spinBusy ? t.stop : freeSpins > 0 ? t.free : t.spin}</span>
            </button>
            <span className={styles.spinHint}>{spinBusy ? 'QUICK STOP AVAILABLE' : freeSpins > 0 ? freeSpins+' FREE SPINS LEFT' : 'SPACE TO SPIN'}</span>
          </div>
        </section>

        <nav className={styles.bottomTools} aria-label="Slot actions">
          <button type="button" data-active={turbo} onClick={() => {setTurbo(value => !value);sfx('tap');}}><FastForward size={19}/><span>{t.turbo}</span></button>
          <button type="button" data-active={autoRemaining > 0} onClick={() => {if(autoRemaining) setAutoRemaining(0);else if(!spinBusy)setModal('auto');}}>{autoRemaining ? <Pause size={19}/> : <Play size={19}/>}<span>{autoRemaining ? 'STOP AUTO ('+autoRemaining+')' : t.auto}</span></button>
          <button type="button" onClick={() => setModal('buy')}><Sparkles size={19}/><span>{t.buy}</span></button>
          <button type="button" onClick={() => setModal('paytable')}><BookOpen size={19}/><span>{t.info}</span></button>
          <button type="button" onClick={() => setModal('history')}><History size={19}/><span>{t.history}</span></button>
          <button type="button" onClick={() => {setSoundOn(x=>!x);sfx('tap');}} aria-label={soundOn?'Mute sound':'Unmute sound'}>{soundOn?<Volume2 size={19}/>:<VolumeX size={19}/>}<span>{soundOn?'SFX ON':'SFX OFF'}</span></button>
          <button type="button" onClick={() => setMusicOn(x=>!x)}>{musicOn?<Music2 size={19}/>:<Music2 size={19}/>}<span>{musicOn?'MUSIC ON':'MUSIC OFF'}</span></button>
          <button type="button" aria-label="Fullscreen" onClick={() => { if(!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(()=>{}); else void document.exitFullscreen?.().catch(()=>{}); }}><Expand size={19}/><span>FULLSCREEN</span></button>
        </nav>
        <p className={styles.disclaimer}><Info size={14}/>{t.note}</p>
      </main>

      {modal && <div className={styles.modalScrim} role="presentation" onMouseDown={event => {if(event.target===event.currentTarget)setModal(null);}}>
        <section className={styles.modal} role="dialog" aria-modal="true" aria-label={modal === 'paytable'?t.payTitle:modal === 'history'?t.historyTitle:modal === 'settings'?t.settingsTitle:modal === 'auto'?t.autoTitle:modal === 'bonus'?t.bonusTitle:t.buyTitle} dir={lang==='fa'?'rtl':'ltr'}>
          <div className={styles.modalHead}>
            <span className={styles.modalIcon}><Sparkles size={20}/></span>
            <h2>{modal === 'paytable'?t.payTitle:modal === 'history'?t.historyTitle:modal === 'settings'?t.settingsTitle:modal === 'auto'?t.autoTitle:modal === 'bonus'?t.bonusTitle:t.buyTitle}</h2>
            <button type="button" onClick={() => setModal(null)} aria-label={t.close}><X size={21}/></button>
          </div>
          {modal === 'paytable' && <>
            <p className={styles.modalText}>{t.rules}</p>
            <div className={styles.paytable}>
              {(Object.keys(PAYTABLE) as Exclude<SymbolId,'scatter'>[]).map(symbol => <div className={styles.paytableRow} key={symbol}>
                <BadgeArt symbol={symbol}/><b>{SYMBOL_LABELS[symbol]}</b>
                <span>3× <strong>{PAYTABLE[symbol][0]}</strong></span>
                <span>4× <strong>{PAYTABLE[symbol][1]}</strong></span>
                <span>5× <strong>{PAYTABLE[symbol][2]}</strong></span>
              </div>)}
            </div>
            <p className={styles.modalText}>Line multiplier × total bet ÷ 20. Scatter awards: 3 = 8 free spins, 4 = 12, 5+ = 20. Winnings calculated in integer cents. {t.note}</p>
          </>}
          {modal === 'history' && <div className={styles.historyList}>
            {rounds.length === 0 ? <p className={styles.modalText}>{t.noHistory}</p> : rounds.map(round => <div className={styles.historyRow} key={round.roundId}>
              <span><Clock3 size={15}/>{new Date(round.createdAt).toLocaleTimeString()}<small>{round.freeSpin?t.freeRound:t.paid}</small></span>
              <span>{cash(round.betCents)} <ChevronDown size={14}/></span>
              <strong data-positive={round.winCents>0}>{cash(round.winCents)}</strong>
            </div>)}
          </div>}
          {modal === 'settings' && <div className={styles.settingList}>
            <label className={styles.settingRow}>{t.sound}<input type="checkbox" checked={soundOn} onChange={e=>setSoundOn(e.target.checked)}/></label>
            <label className={styles.settingSlider}>SFX VOLUME <input type="range" min="0" max="1" step=".01" value={soundVolume} onChange={e=>setSoundVolume(Number(e.target.value))}/></label>
            <label className={styles.settingRow}>{t.music}<input type="checkbox" checked={musicOn} onChange={e=>setMusicOn(e.target.checked)}/></label>
            <label className={styles.settingSlider}>MUSIC VOLUME <input type="range" min="0" max=".5" step=".01" value={musicVolume} onChange={e=>setMusicVolume(Number(e.target.value))}/></label>
            <label className={styles.settingRow}>{t.reduce}<input type="checkbox" checked={reduceMotion} onChange={e=>setReduceMotion(e.target.checked)}/></label>
            <button type="button" className={styles.resetButton} disabled={spinBusy || freeSpins>0} onClick={() => {setBalanceCents(DEMO_START_CENTS);setNotice('');setRounds([]);setLastSpin(null);setAutoRemaining(0);setModal(null);}}><RotateCcw size={17}/>{t.reset}</button>
          </div>}
          {modal === 'auto' && <>
            <p className={styles.modalText}>{t.autoHint}</p>
            <div className={styles.autoChoices}>{[10,25,50].map(count => <button key={count} type="button" onClick={() => {setAutoRemaining(count);setModal(null);sfx('tap');}}>{count}<span>SPINS</span></button>)}</div>
          </>}
          {modal === 'bonus' && <div className={styles.bonusDialog}>
            <Sparkles size={58} strokeWidth={1.3}/>
            <strong>{freeSpins} {t.free}</strong>
            <p>{t.bonusHint}</p>
            <button type="button" className={styles.confirm} onClick={()=>{setModal(null);sfx('tap');}}><Check size={19}/>{t.resume}</button>
          </div>}
          {modal === 'buy' && <div className={styles.bonusDialog}>
            <CircleHelp size={46}/>
            <p>{t.buyHint}</p>
            <span className={styles.demoFlag}>{t.noBuy}</span>
            <button type="button" className={styles.confirm} onClick={()=>setModal(null)}>{t.close}</button>
          </div>}
        </section>
      </div>}
    </div>
  );
}
