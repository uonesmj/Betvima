'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, CircleHelp, Coins, Crown, Diamond, Gem, KeyRound, LockKeyhole,
  Minus, Plus, RotateCcw, Shield, Sparkles, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { OriginalsWalletReadonly } from '@/components/casino/originals-wallet-readonly';
import {
  INITIAL_ROYAL_GRID, ROYAL_MULTIPLIERS, ROYAL_PAYLINES, ROYAL_SYMBOLS,
  ROYAL_THEORETICAL_RTP, ROYAL_VAULT_BETS, ROYAL_VAULT_START_CREDITS,
  royalSpin, settleRoyalGrid, ROYAL_VAULT_MATH_VERSION, type RoyalGrid, type RoyalRound, type RoyalSymbol,
} from '@/lib/originals/royal-vault';

const SYMBOL_LABELS: Record<RoyalSymbol, string> = {
  crown: 'Royal Crown', diamond: 'Blue Diamond', key: 'Golden Key', lion: 'Lion Shield',
  coin: 'BetVima Coin', vault: 'Royal Vault', ruby: 'Ruby', gold: 'Gold Bars',
};
const money = (n: number) => n.toLocaleString('en-US');

function RoyalSymbolArt({ symbol }: { symbol: RoyalSymbol }) {
  const iconProps = { size: 39, strokeWidth: 1.7, 'aria-hidden': true as const };
  return (
    <div className={'rv-art rv-art--' + symbol} role="img" aria-label={SYMBOL_LABELS[symbol]}>
      <span className="rv-art-shimmer" aria-hidden="true" />
      {symbol === 'crown' ? <Crown {...iconProps} /> : null}
      {symbol === 'diamond' ? <Gem {...iconProps} /> : null}
      {symbol === 'key' ? <KeyRound {...iconProps} /> : null}
      {symbol === 'lion' ? (
        <svg viewBox="-115 -120 230 240" className="rv-lion-icon" aria-hidden="true">
          <use href="/originals/royal-vault-hero.svg#lion" />
        </svg>
      ) : null}
      {symbol === 'coin' ? <span className="rv-coin-mark" aria-hidden="true">V</span> : null}
      {symbol === 'vault' ? <span className="rv-vault-mark" aria-hidden="true"><LockKeyhole size={34} strokeWidth={1.9} /><small>VAULT</small></span> : null}
      {symbol === 'ruby' ? <Diamond {...iconProps} /> : null}
      {symbol === 'gold' ? <span className="rv-gold-mark" aria-hidden="true"><Coins size={36} strokeWidth={1.8} /><small>GOLD</small></span> : null}
    </div>
  );
}

type Modal = 'paytable' | 'rules' | null;
const INITIAL_STATS = { rounds: 0, staked: 0, paid: 0 };

export function RoyalVaultGame() {
  const { locale, session } = useApp();
  const t = (en: string, fa: string) => locale === 'fa' ? fa : en;
  const [credits, setCredits] = useState(ROYAL_VAULT_START_CREDITS);
  const creditsRef = useRef(ROYAL_VAULT_START_CREDITS);
  const [betIndex, setBetIndex] = useState(2);
  const betRef = useRef<number>(ROYAL_VAULT_BETS[2]);
  const [grid, setGrid] = useState<RoyalGrid>(INITIAL_ROYAL_GRID);
  const [rolling, setRolling] = useState(false);
  const rollingRef = useRef(false);
  const [revealed, setRevealed] = useState(5);
  const [lastRound, setLastRound] = useState<RoyalRound | null>(null);
  const [status, setStatus] = useState('');
  const [autoRemaining, setAutoRemaining] = useState(0);
  const autoRef = useRef(0);
  const [turbo, setTurbo] = useState(false);
  const turboRef = useRef(false);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [stats, setStats] = useState(INITIAL_STATS);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  const stopAuto = useCallback(() => {
    autoRef.current = 0;
    if (mountedRef.current) setAutoRemaining(0);
  }, []);

  const queue = useCallback((callback: () => void, delay: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((timer) => timer !== id);
      if (mountedRef.current) callback();
    }, delay);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const visibilityHandler = () => {
      if (document.hidden) stopAuto();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      autoRef.current = 0;
      document.removeEventListener('visibilitychange', visibilityHandler);
      const audio = audioRef.current;
      if (audio) void audio.close().catch(() => {});
    };
  }, [stopAuto]);

  const playTone = useCallback((win: boolean) => {
    if (!soundRef.current || typeof window === 'undefined') return;
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = win ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(win ? 650 : 230, ctx.currentTime);
      if (win) oscillator.frequency.exponentialRampToValueAtTime(985, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (win ? 0.34 : 0.09));
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + (win ? 0.35 : 0.1));
    } catch {
      // Audio is optional and never affects the round result.
    }
  }, []);

  const changeBet = (nextIndex: number) => {
    if (rollingRef.current) return;
    const clamped = Math.min(ROYAL_VAULT_BETS.length - 1, Math.max(0, nextIndex));
    betRef.current = ROYAL_VAULT_BETS[clamped]!;
    setBetIndex(clamped);
  };

  const beginRound = async () => {
    if (rollingRef.current || !mountedRef.current) return;
    const bet = betRef.current;
    if (creditsRef.current < bet) {
      stopAuto();
      setStatus(t('Not enough demo credits. Reset to play again.', 'اعتبار نمایشی کافی نیست؛ برای ادامه بازنشانی کنید.'));
      return;
    }
    // Lock UI before awaiting a server response, preventing concurrent spins.
    rollingRef.current = true;
    setRolling(true);
    setStatus(t('Determining demo result...', 'در حال تعیین نتیجه آزمایشی...'));
    let round: RoyalRound;
    try {
      if (session?.authenticated) {
        const response = await fetch('/api/v1/originals/royal-vault/demo-spin', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stakeCredits: bet }),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error('DEMO_SERVER_UNAVAILABLE');
        const payload = await response.json() as {
          ok?: boolean; data?: { mode?: string; round?: RoyalRound };
        };
        const result = payload.data?.round;
        if (payload.ok !== true || payload.data?.mode !== 'demo' ||
            !result || result.version !== ROYAL_VAULT_MATH_VERSION || result.bet !== bet) {
          throw new Error('DEMO_INVALID_RESPONSE');
        }
        // Verify the declared winnings against the public versioned paytable.
        const verified = settleRoyalGrid(result.grid, bet);
        if (verified.totalAward !== result.totalAward ||
            JSON.stringify(verified.wins) !== JSON.stringify(result.wins)) {
          throw new Error('DEMO_INVALID_OUTCOME');
        }
        round = verified;
      } else {
        // Guests can still play locally without logging in; never for cash.
        round = royalSpin(bet);
      }
      if (!mountedRef.current) return;
    } catch {
      if (mountedRef.current) {
        rollingRef.current = false;
        setRolling(false);
        stopAuto();
        setRevealed(5);
        setStatus(t('Demo result unavailable. No credits were deducted.', 'نتیجه آزمایشی در دسترس نیست. اعتباری کسر نشده است.'));
      }
      return;
    }
    creditsRef.current -= bet;
    setCredits(creditsRef.current);
    setRolling(true);
    setRevealed(0);
    setLastRound(null);
    setStatus('');
    setGrid(round.grid);
    playTone(false);

    const firstStop = turboRef.current ? 240 : 830;
    const stagger = turboRef.current ? 115 : 230;
    for (let reel = 1; reel <= 5; reel += 1) {
      queue(() => setRevealed(reel), firstStop + (reel - 1) * stagger);
    }
    queue(() => {
      creditsRef.current += round.totalAward;
      setCredits(creditsRef.current);
      setLastRound(round);
      setStats((current) => ({
        rounds: current.rounds + 1,
        staked: current.staked + bet,
        paid: current.paid + round.totalAward,
      }));
      rollingRef.current = false;
      setRolling(false);
      setStatus(round.totalAward
        ? t('Winning paylines: ', 'خطوط برنده: ') + round.wins.map((win) => win.line).join(', ')
        : t('No winning line this round.', 'در این دور خط برنده‌ای ثبت نشد.'));
      if (round.totalAward) playTone(true);

      if (autoRef.current > 0) {
        autoRef.current -= 1;
        setAutoRemaining(autoRef.current);
        if (autoRef.current > 0) queue(() => beginRound(), turboRef.current ? 220 : 600);
      }
    }, firstStop + 5 * stagger);
  };

  const toggleAuto = () => {
    if (autoRef.current > 0) {
      stopAuto();
      return;
    }
    if (rollingRef.current) return;
    autoRef.current = 10; // Exactly 10 rounds at most; stops on tab hide or insufficient balance.
    setAutoRemaining(10);
    beginRound();
  };

  const resetDemo = () => {
    if (rollingRef.current) return;
    stopAuto();
    creditsRef.current = ROYAL_VAULT_START_CREDITS;
    setCredits(ROYAL_VAULT_START_CREDITS);
    setGrid(INITIAL_ROYAL_GRID);
    setLastRound(null);
    setStats(INITIAL_STATS);
    setRevealed(5);
    setStatus('');
  };

  const highlighted = new Set(
    (lastRound?.wins ?? []).flatMap((win) =>
      win.positions.map((position) => position.reel + '-' + position.row)),
  );
  const lastAward = lastRound?.totalAward ?? 0;
  const bet = ROYAL_VAULT_BETS[betIndex]!;

  return (
    <div className="rv-world" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div className="rv-toolbar">
        <Link href="/casino/originals" className="rv-back"><ArrowLeft size={16} /> {t('Originals', 'بازی‌های اختصاصی')}</Link>
        <div className="rv-status-pill"><span /> BetVima Originals <span className="rv-demo-tag">DEMO</span></div>
      </div>

      <section className="rv-cabinet" aria-label="BetVima Royal Vault slot game">
        <div className="rv-banner">
          <Image src="/originals/royal-vault-hero.svg" alt="BetVima Royal Vault, golden lions and a royal vault" width={1080} height={440} priority unoptimized />
        </div>

        <div className="rv-dashboard">
          <div className="rv-balance" role="status">
            <span>{t('Free demo balance', 'موجودی آزمایشی رایگان')}</span>
            <strong className="rv-number"><Coins size={17} /> {money(credits)} <small>CR</small></strong>
            <button type="button" onClick={resetDemo} disabled={rolling} className="rv-reset"><RotateCcw size={12} />{t('Reset', 'بازنشانی')}</button>
          </div>
          <div className="rv-wallet-note"><LockKeyhole size={17} /><span>{t('Demo credits have no cash value.', 'اعتبار آزمایشی ارزش نقدی ندارد.')}</span></div>
        </div>

        <OriginalsWalletReadonly />

        <div className="rv-game-inner">
          <div className="rv-reel-halo">
            <div className="rv-reel-header"><Sparkles size={13} /> <span>5 REELS · 5 PAYLINES</span><Sparkles size={13} /></div>
            <div className="rv-reel-grid" aria-label={t('Five reels, three rows', 'پنج ریل، سه ردیف')} aria-busy={rolling}>
              {grid.map((column, reel) => (
                <div key={reel} className={'rv-reel ' + (rolling && revealed <= reel ? 'rv-reel--rolling' : 'rv-reel--stopped')}>
                  {rolling && revealed <= reel ? (
                    <div className="rv-ticker" aria-hidden="true">
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className="rv-symbol"><RoyalSymbolArt symbol={ROYAL_SYMBOLS[(i + reel) % ROYAL_SYMBOLS.length]!} /></div>
                      ))}
                    </div>
                  ) : column.map((symbol, row) => (
                    <div key={row} className={'rv-symbol ' + (highlighted.has(reel + '-' + row) ? 'rv-symbol--win' : '')}>
                      <RoyalSymbolArt symbol={symbol} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="rv-payline-legend">
              {ROYAL_PAYLINES.map((_, index) => <span key={index} className={lastRound?.wins.some((win) => win.line === index + 1) ? 'rv-line-tag rv-line-tag--win' : 'rv-line-tag'}>{index + 1}</span>)}
            </div>
          </div>

          <div className={'rv-win-panel ' + (lastAward > 0 ? 'rv-win-panel--active' : '')} role="status" aria-live="polite">
            <span>{rolling ? t('Spinning', 'چرخش ریل‌ها') : t('Last round payout', 'پرداخت دور آخر')}</span>
            <strong className="rv-number">{rolling ? '···' : money(lastAward)} <small>CR</small></strong>
          </div>
          <p className="rv-round-status" role="status">{status || t('Match symbols from left to right to win virtual credits.', 'نمادها را از چپ به راست روی خطوط هماهنگ کنید و اعتبار مجازی ببرید.')}</p>

          <div className="rv-controls">
            <div className="rv-bet-controls">
              <span className="rv-control-heading">{t('BET · DEMO CREDITS', 'مقدار بازی · اعتبار آزمایشی')}</span>
              <div className="rv-bet-stepper">
                <button type="button" aria-label={t('Decrease demo stake', 'کاهش اعتبار بازی')} onClick={() => changeBet(betIndex - 1)} disabled={rolling || betIndex === 0}><Minus size={18}/></button>
                <strong className="rv-number">{money(bet)} <small>CR</small></strong>
                <button type="button" aria-label={t('Increase demo stake', 'افزایش اعتبار بازی')} onClick={() => changeBet(betIndex + 1)} disabled={rolling || betIndex === ROYAL_VAULT_BETS.length - 1}><Plus size={18}/></button>
              </div>
              <span className="rv-small-label">{t('Stake is split across 5 paylines', 'اعتبار بین ۵ خط تقسیم می‌شود')}</span>
            </div>
            <button type="button" className="rv-spin" onClick={beginRound} disabled={rolling || credits < bet} aria-label={t('Spin reels', 'چرخاندن ریل‌ها')}>
              <Crown size={25} /><strong>{rolling ? t('ROLLING', 'در حال چرخش') : 'SPIN'}</strong>
            </button>
            <div className="rv-side-buttons">
              <button type="button" className="rv-control-button" disabled={rolling || betIndex === ROYAL_VAULT_BETS.length - 1} onClick={() => changeBet(ROYAL_VAULT_BETS.length - 1)}><Coins size={17} />{t('MAX BET', 'حداکثر')}</button>
              <button type="button" className={'rv-control-button ' + (autoRemaining ? 'rv-control-button--active' : '')} onClick={toggleAuto}>
                <RotateCcw size={17} />{autoRemaining ? t('STOP AUTO', 'توقف خودکار') : t('AUTO ×10', 'خودکار ×۱۰')}
              </button>
            </div>
          </div>

          <div className="rv-footer-tools">
            <button type="button" onClick={() => setModal('paytable')}><CircleHelp size={19}/>{t('Paytable', 'جدول پرداخت')}</button>
            <button type="button" onClick={() => setModal('rules')}><Shield size={19}/>{t('Game rules', 'قوانین')}</button>
            <button type="button" aria-pressed={sound} onClick={() => { soundRef.current = !soundRef.current; setSound(soundRef.current); }}>
              {sound ? <Volume2 size={19}/> : <VolumeX size={19}/>} {t('Sound', 'صدا')}: {sound ? 'ON' : 'OFF'}
            </button>
            <button type="button" aria-pressed={turbo} onClick={() => { turboRef.current = !turboRef.current; setTurbo(turboRef.current); }}><Zap size={19}/>{t('Turbo', 'سریع')}: {turbo ? 'ON' : 'OFF'}</button>
          </div>
          <div className="rv-stats" aria-label={t('Demo session statistics', 'آمار جلسه آزمایشی')}>
            <span>{t('Rounds', 'دورها')} <strong>{money(stats.rounds)}</strong></span>
            <span>{t('Staked', 'بازی‌شده')} <strong>{money(stats.staked)} CR</strong></span>
            <span>{t('Payouts', 'پرداخت‌ها')} <strong>{money(stats.paid)} CR</strong></span>
            <span>{t('Theoretical RTP', 'بازگشت نظری')} <strong>{(ROYAL_THEORETICAL_RTP * 100).toFixed(2)}%</strong></span>
          </div>
        </div>
      </section>

      <p className="rv-disclaimer">{t(
        'Prototype for demonstration only. Results and virtual credits are local to this browser session, cannot be deposited, transferred or withdrawn, and have not been independently certified for real-money play.',
        'این نمونه فقط نمایشی است. نتیجه‌ها و اعتبار مجازی در همین جلسه مرورگر نگهداری می‌شوند و امکان واریز، انتقال یا برداشت ندارند. بازی برای پول واقعی گواهی مستقل دریافت نکرده است.',
      )}</p>

      {modal && <div className="rv-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="rv-dialog" role="dialog" aria-modal="true" aria-labelledby="rv-dialog-heading">
          <header><h2 id="rv-dialog-heading">{modal === 'paytable' ? t('Royal Vault paytable', 'جدول پرداخت رویال والت') : t('Royal Vault rules', 'قوانین رویال والت')}</h2>
            <button type="button" onClick={() => setModal(null)} aria-label={t('Close', 'بستن')}><X size={21}/></button></header>
          {modal === 'paytable' ? (
            <div className="rv-dialog-body">
              <p>{t('All eight symbols use the same multipliers. Rewards apply per winning line, based on one fifth of your total demo stake.', 'هر هشت نماد ضریب یکسان دارند. پرداخت هر خط از یک‌پنجم مبلغ بازی آزمایشی محاسبه می‌شود.')}</p>
              <table><thead><tr><th>{t('Consecutive matching symbols', 'تعداد نماد متوالی')}</th><th>{t('Line multiplier', 'ضریب خط')}</th></tr></thead>
                <tbody>{([2, 3, 4, 5] as const).map((count) => <tr key={count}><td>{count}</td><td>×{ROYAL_MULTIPLIERS[count]}</td></tr>)}</tbody></table>
              <p>{t('Five paylines: top, middle, bottom, descending V and ascending V. Payouts on different lines are added together.', 'پنج خط پرداخت: بالا، وسط، پایین، V و V وارونه. جوایز خطوط مختلف با هم جمع می‌شوند.')}</p>
            </div>
          ) : (
            <div className="rv-dialog-body">
              <p>{t('Royal Vault is a free play-for-fun five-reel, three-row slot with eight equally likely symbols and five fixed paylines.', 'رویال والت یک اسلات آزمایشی رایگان با پنج ریل، سه ردیف، هشت نماد با احتمال برابر و پنج خط ثابت است.')}</p>
              <p>{t('A win requires two or more identical symbols consecutively from the leftmost reel on a fixed payline. There are no wilds, free spins or hidden bonus features in this version.', 'برد به حداقل دو نماد مشابه و متوالی از اولین ریل سمت چپ روی یک خط نیاز دارد. این نسخه وایلد، چرخش رایگان یا بونوس مخفی ندارد.')}</p>
              <p>{t('Published math version: rv-demo-1. Exact theoretical return: 91.259765625% of demo stakes over all possible outcomes. Individual session results can vary.', 'نسخه ریاضی rv-demo-1 و بازگشت نظری دقیق ۹۱٫۲۵۹۷۶۵۶۲۵٪ است. نتایج هر جلسه می‌توانند متفاوت باشند.')}</p>
              <p>{t('Auto play runs for at most 10 spins, can be stopped anytime, and stops automatically when leaving the tab or when credits are insufficient. All game data is non-financial.', 'بازی خودکار حداکثر ۱۰ دور اجرا می‌شود و قابل توقف است. با ترک تب یا کمبود اعتبار متوقف می‌شود. تمام اطلاعات بازی غیرمالی است.')}</p>
            </div>
          )}
          <footer><button type="button" onClick={() => setModal(null)}>{t('Got it', 'متوجه شدم')}</button></footer>
        </section>
      </div>}
    </div>
  );
}
