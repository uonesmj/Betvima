'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  evaluateGrid,
  INITIAL_GRID,
  randomGrid,
  PAYLINES,
  STARTING_DEMO_CREDITS,
  SYMBOL_LABELS,
  SYMBOL_MULTIPLIERS,
  type ReelGrid,
  type SymbolId,
  type SpinEvaluation,
} from '@/lib/casino/royal-neon-demo';
import styles from './royal-neon-slot.module.css';

const BET_LEVELS = [10, 20, 50, 100] as const;
const REEL_SPIN_DURATION = 800;
const REEL_STOP_OFFSET = 255;
const LAST_REEL_STOP = REEL_SPIN_DURATION + 4 * REEL_STOP_OFFSET;
const GOLD_SYMBOLS: SymbolId[] = ['crown', 'seven', 'diamond', 'ruby', 'emerald', 'star', 'wild'];
const SYMBOL_COLORS: Record<SymbolId, string> = {
  crown: '#f7d16e',
  seven: '#f7ac72',
  diamond: '#74d9ff',
  ruby: '#ff6285',
  emerald: '#6cecb7',
  star: '#ffdd89',
  wild: '#c09fff',
};

function SymbolArt({ symbol }: { symbol: SymbolId }) {
  return (
    <svg className={styles.symbolSvg} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {symbol === 'crown' && (
        <>
          <path d="M13 68 9 28 31 45 50 16 69 45 91 28 87 68Z" fill="#edb955" stroke="#ffe7a3" strokeWidth="3" strokeLinejoin="round" />
          <path d="M14 68 H86 V77 Q50 88 14 77Z" fill="#a96c29" stroke="#ffdea0" strokeWidth="3" />
          <path d="M24 62 H76 M20 70 H80" stroke="#fff0b8" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 42 57 51 50 61 43 51Z" fill="#54cbea" stroke="#ffffff" strokeWidth="1.4" />
          <circle cx="11" cy="27" r="5" fill="#fff2ba" />
          <circle cx="50" cy="15" r="5" fill="#fff2ba" />
          <circle cx="89" cy="27" r="5" fill="#fff2ba" />
        </>
      )}
      {symbol === 'seven' && (
        <>
          <path d="M18 25 H83 L48 84 H27 L57 43 H18Z" fill="#df6b3c" stroke="#ffdf9a" strokeWidth="4" strokeLinejoin="round" />
          <path d="M23 27 H77 L46 76" fill="none" stroke="#fff4c9" strokeWidth="6" strokeLinecap="round" />
          <path d="M20 17 L25 10 M75 87 L82 81" stroke="#ffe7a3" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {symbol === 'diamond' && (
        <>
          <path d="M13 37 34 17 H67 L88 37 50 84Z" fill="#207dbe" stroke="#a6ecff" strokeWidth="3" strokeLinejoin="round" />
          <path d="M13 37 H88 L50 84Z" fill="#46beea" />
          <path d="M34 17 42 37 50 84 58 37 67 17" fill="none" stroke="#d9f8ff" strokeWidth="2.5" opacity=".92" />
          <path d="M13 37 42 37 34 17 M88 37 58 37 67 17" fill="#9aebff" opacity=".55" />
          <path d="M44 20 H61" stroke="#e3ffff" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {symbol === 'ruby' && (
        <>
          <path d="M50 10 79 27 87 60 50 88 13 60 21 27Z" fill="#b32053" stroke="#ff98b3" strokeWidth="3" strokeLinejoin="round" />
          <path d="M50 10 62 39 50 88 38 39Z" fill="#ff668d" opacity=".8" />
          <path d="M21 27 38 39 13 60 M79 27 62 39 87 60" fill="none" stroke="#ffd5e0" strokeWidth="2.3" />
          <path d="M21 27 50 10 79 27 62 39 H38Z" fill="#ff9db5" opacity=".75" />
          <path d="M29 30 42 19" stroke="#ffe1e9" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {symbol === 'emerald' && (
        <>
          <path d="M30 12 H70 L87 31 V69 L70 87 H30 L13 69 V31Z" fill="#158b6e" stroke="#a2ffe0" strokeWidth="3" strokeLinejoin="round" />
          <path d="M30 12 36 35 H64 L70 12 M13 31 36 35 30 87 M87 31 64 35 70 87" stroke="#d9fff0" strokeWidth="2.3" fill="none" opacity=".85" />
          <path d="M36 35 H64 L74 50 64 66 H36 L26 50Z" fill="#67edaf" opacity=".7" />
          <path d="M40 19 H60" stroke="#ddfff0" strokeWidth="3.3" strokeLinecap="round" />
        </>
      )}
      {symbol === 'star' && (
        <>
          <path d="M50 10 62 37 92 39 70 59 76 89 50 73 24 89 30 59 8 39 38 37Z" fill="#d49c30" stroke="#fff0b5" strokeWidth="3" strokeLinejoin="round" />
          <path d="M50 17 57 44 82 44 62 59 68 78 50 65 32 78 38 59 18 44 43 44Z" fill="#fff3b9" />
          <path d="M50 20 V64 M23 45 L50 45" stroke="#fff" strokeWidth="3" opacity=".65" />
        </>
      )}
      {symbol === 'wild' && (
        <>
          <circle cx="50" cy="50" r="39" fill="#7242ac" stroke="#cfaaff" strokeWidth="4" />
          <circle cx="50" cy="50" r="31" fill="none" stroke="#f4dcff" strokeWidth="2" strokeDasharray="4 5" />
          <path d="M24 35 33 67 47 43 60 67 77 35" fill="none" stroke="#f4dcff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 19 26 10 30 19 39 23 30 26 26 36 22 26 13 23Z" fill="#fff2c3" />
        </>
      )}
    </svg>
  );
}

function Tile({
  symbol,
  rolling,
  winner,
}: {
  symbol: SymbolId;
  rolling: boolean;
  winner: boolean;
}) {
  return (
    <div
      className={[styles.tile, winner ? styles.tileWin : ''].filter(Boolean).join(' ')}
      aria-label={SYMBOL_LABELS[symbol]}
      title={SYMBOL_LABELS[symbol]}
    >
      <SymbolArt symbol={symbol} />
    </div>
  );
}

function shortNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

/** No session IDs, server wagering APIs or production wallet mutations. */
export function RoyalNeonSlot() {
  const [grid, setGrid] = useState<ReelGrid>(INITIAL_GRID);
  const [rolling, setRolling] = useState<boolean[]>([false, false, false, false, false]);
  const [balance, setBalance] = useState(STARTING_DEMO_CREDITS);
  const [betIndex, setBetIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<SpinEvaluation | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [spins, setSpins] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [burstId, setBurstId] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [message, setMessage] = useState('Choose your demo stake and spin to play');
  const intervalRef = useRef<number | null>(null);
  const spinningRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bet = BET_LEVELS[betIndex]!;

  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    spinningRef.current = false;
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  const playTone = (frequency: number, duration = 0.09) => {
    if (!soundOn) return;
    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.07, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Audio is optional and must never block gameplay.
    }
  };

  const spin = () => {
    if (spinningRef.current || balance < bet) return;
    spinningRef.current = true;
    setIsSpinning(true);
    setLastResult(null);
    setLastWin(0);
    setRolling([true, true, true, true, true]);
    setMessage('Reels spinning…');
    setBalance((current) => current - bet);
    playTone(370, 0.13);

    // Generate the entire outcome first; animation cannot influence results.
    // DEMO ONLY: Math.random, no certified RNG, no wager or wallet integration.
    const outcome = randomGrid();
    const evaluation = evaluateGrid(outcome, bet);
    const startedAt = performance.now();

    intervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const isRolling = Array.from({ length: 5 }, (_, reel) =>
        elapsed < REEL_SPIN_DURATION + reel * REEL_STOP_OFFSET
      );
      const movingSymbols = randomGrid();
      setGrid(outcome.map((reel, index) => isRolling[index] ? movingSymbols[index]! : reel));
      setRolling(isRolling);

      if (elapsed < LAST_REEL_STOP + 80) return;

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setGrid(outcome);
      setRolling([false, false, false, false, false]);
      setLastResult(evaluation);
      setLastWin(evaluation.payout);
      setBalance((current) => current + evaluation.payout);
      setSpins((current) => current + 1);
      setMessage(evaluation.payout > 0
        ? 'WIN! ' + shortNumber(evaluation.payout) + ' demo credits • ' + evaluation.wins.length + ' winning line(s)'
        : 'No matching line this spin — try again');
      setIsSpinning(false);
      spinningRef.current = false;
      if (evaluation.payout > 0) {
        setBurstId((current) => current + 1);
        playTone(880, .35);
      } else {
        playTone(240, .12);
      }
    }, 65);
  };

  const reset = () => {
    if (spinningRef.current) return;
    setGrid(INITIAL_GRID);
    setBalance(STARTING_DEMO_CREDITS);
    setLastResult(null);
    setLastWin(0);
    setSpins(0);
    setMessage('Demo credits have been reset');
    playTone(540);
  };

  const winningCells = new Set(
    (lastResult?.wins ?? []).flatMap((win) =>
      win.positions.map((position) => position.reel + ':' + position.row)
    )
  );

  return (
    <main className={styles.root}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandGlyph} aria-hidden="true">◆</span>
            BETVIMA <span style={{ color: '#dfb66f' }}>STUDIOS</span>
          </div>
          <div className={styles.navActions}>
            <span className={styles.demoTag}>FREE DEMO · NO REAL MONEY</span>
            <Link className={styles.back} href="/casino" aria-label="Back to Casino">← Casino</Link>
          </div>
        </div>

        <header className={styles.heading}>
          <div className={styles.kicker}>An original BetVima experience</div>
          <h1 className={styles.title}>ROYAL NEON</h1>
          <p className={styles.subtitle}>Five reels. Ten paylines. A world of golden light.</p>
        </header>

        <div className={styles.layout}>
          <section className={styles.machine} aria-label="Royal Neon demo slot machine">
            <div className={styles.machineTop}>
              <div className={styles.crownIcon} aria-hidden="true">♛</div>
              <div className={styles.machineTitle}>ROYAL NEON</div>
              <div className={styles.machineSub}>5 reels · 3 rows · 10 fixed lines</div>
            </div>

            <div className={styles.machineInner}>
              <div className={styles.reels} aria-label="Slot reels">
                {grid.map((reel, column) => (
                  <div
                    key={column}
                    className={[styles.reel, rolling[column] ? styles.rolling : ''].filter(Boolean).join(' ')}
                    aria-label={'Reel ' + (column + 1)}
                  >
                    {reel.map((symbol, row) => (
                      <Tile
                        key={row}
                        symbol={symbol}
                        rolling={Boolean(rolling[column])}
                        winner={!isSpinning && winningCells.has(column + ':' + row)}
                      />
                    ))}
                  </div>
                ))}
                <div className={styles.reelsOverlay} aria-hidden="true" />
                {lastWin > 0 && !isSpinning && (
                  <div key={burstId} className={styles.burstStage} aria-hidden="true">
                    {Array.from({ length: 18 }, (_, index) => (
                      <span
                        key={index}
                        className={styles.burstRay}
                        style={{ transform: 'rotate(' + index * 20 + 'deg)' }}
                      ><i style={{ animationDelay: index % 4 * 0.06 + 's' }} /></span>
                    ))}
                  </div>
                )}
              </div>
              <p className={[styles.resultBar, lastWin > 0 ? styles.won : ''].filter(Boolean).join(' ')} role="status" aria-live="polite">
                {message}
              </p>
            </div>

            <div className={styles.machineBottom}>
              <div>
                <div className={styles.balanceTitle}>Your demo balance</div>
                <div className={styles.balanceValue}><span className={styles.token} aria-hidden="true">B</span>{shortNumber(balance)}</div>
              </div>
              <div className={styles.miniStat}>
                <div className={styles.balanceTitle}>Last win</div>
                <b>{shortNumber(lastWin)}</b>
              </div>
              <div className={styles.miniStat}>
                <div className={styles.balanceTitle}>Spins played</div>
                <b>{shortNumber(spins)}</b>
              </div>
            </div>
          </section>

          <aside className={styles.panel} aria-label="Demo slot controls">
            <div className={styles.panelCard}>
              <div className={styles.panelCaption}>Demo wager · credits</div>
              <div className={styles.betRow}>
                <button type="button" className={styles.changeBet} aria-label="Decrease demo stake" onClick={() => setBetIndex((i) => Math.max(0, i - 1))} disabled={isSpinning || betIndex === 0}>−</button>
                <span className={styles.betValue}>{shortNumber(bet)}</span>
                <button type="button" className={styles.changeBet} aria-label="Increase demo stake" onClick={() => setBetIndex((i) => Math.min(BET_LEVELS.length - 1, i + 1))} disabled={isSpinning || betIndex === BET_LEVELS.length - 1}>+</button>
              </div>
              <button type="button" className={styles.spinButton} onClick={spin} disabled={isSpinning || balance < bet}>
                <span className={styles.spinArrow} aria-hidden="true">⟳</span>
                {isSpinning ? 'SPINNING' : 'SPIN'}
              </button>
              <div className={styles.controlsNote}>
                {balance < bet
                  ? 'Not enough demo credits. Reset to keep playing.'
                  : 'Tap SPIN to play all 10 fixed paylines.'}
              </div>
              <button type="button" className={styles.reset} onClick={reset} disabled={isSpinning}>↻ Reset demo balance</button>
              <button type="button" className={styles.reset} onClick={() => setSoundOn((value) => !value)} aria-pressed={soundOn}>
                {soundOn ? '♫ Sound on' : '♪ Sound off'} · Tap to toggle
              </button>
            </div>

            <div className={styles.panelCard}>
              <h2 className={styles.sectionTitle}>Top symbols · 5 of a kind</h2>
              <div className={styles.payList}>
                {GOLD_SYMBOLS.map((symbol) => (
                  <div className={styles.payItem} key={symbol}>
                    <div className={styles.paySymbol}>
                      <span className={styles.payDot} style={{ '--color': SYMBOL_COLORS[symbol] } as CSSProperties} />
                      {SYMBOL_LABELS[symbol]}
                    </div>
                    <span className={styles.payValue}>{SYMBOL_MULTIPLIERS[symbol][2]}×</span>
                  </div>
                ))}
              </div>
              <p className={styles.smallText} style={{ marginTop: 13 }}>
                Payout multiples apply to each winning line&apos;s stake (total demo stake ÷ {PAYLINES.length}).
              </p>
            </div>

            <div className={styles.panelCard}>
              <button
                className={styles.smallButton}
                type="button"
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => setShowRules((value) => !value)}
                aria-expanded={showRules}
              >
                Game rules <span>{showRules ? '−' : '+'}</span>
              </button>
              {showRules && (
                <div className={styles.smallText} style={{ marginTop: 12 }}>
                  Match 3, 4 or 5 symbols on one of the 10 fixed paylines, reading from the leftmost reel.
                  Wild replaces other symbols. All eligible lines pay on the same spin.
                  The demo starts with 1,000 free credits; resets are unlimited.
                  Results use a non-certified browser RNG and have no monetary value.
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className={styles.notice}>
          <strong>Preview only.</strong> This original BetVima game does not connect to your wallet,
          accept deposits, award cash, or alter real balances. Game mathematics, RNG, regulatory
          readiness and server-side financial settlement require separate validation before any real-money release.
        </div>
        <div className={styles.footer}>
          <span>© BetVima Studios</span>
          <span><strong>ROYAL NEON</strong> · Prototype 01</span>
          <span>Built for desktop &amp; mobile</span>
        </div>
      </div>
    </main>
  );
}
