'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ChevronDown,
  IdCard,
  Trash2,
  X,
  WalletCards,
  CircleHelp, Gift, Receipt,
  Share2,
} from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { useBetSlip } from '@/lib/store/betslip';
import { isCurrentQuote, placementIntentFingerprint, quoteContextFingerprint } from '@/lib/bet-placement-fingerprint';
import { formatMinor, formatOddsScaled } from '@/lib/i18n';
import { ApiClientError, apiRequest } from '@/lib/hooks/useApi';

interface QuoteResponse {
  quote: {
    combinedOddsScaled: string; potentialPayoutMinor: string; warnings: string[];
    oddsChanges: { selectionId: string; previousOddsScaled: string; currentOddsScaled: string; currentOddsVersion: number; direction: 'UP' | 'DOWN' }[];
    quoteToken: string; expiresAt: string; contextKey?: string;
  };
}

const PENDING_QUOTE_STORAGE_KEY = 'nova:betslip:pending-quote';

function readStoredPendingQuote(): QuoteResponse['quote'] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_QUOTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuoteResponse['quote'];
    if (!parsed?.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(parsed.oddsChanges) || parsed.oddsChanges.length === 0) {
      window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistPendingQuote(quote: QuoteResponse['quote'] | null) {
  if (typeof window === 'undefined') return;
  try {
    if (quote) {
      window.sessionStorage.setItem(
        PENDING_QUOTE_STORAGE_KEY,
        JSON.stringify(quote),
      );
    } else {
      window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
    }
  } catch {}
}

/**
 * BET SLIP - opens ONLY from the dedicated control (`openFromControl`). The desktop rail
 * and the mobile bottom sheet are the same component tree, so behaviour cannot diverge.
 */

function moneyInputFromMinor(minor: string, currency: string): string {
  const value = BigInt(minor || '0');
  if (currency === 'IRT' || currency === 'IRR') return value.toString();
  const whole = value / 100n;
  const fraction = value % 100n;
  return `${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}

function moneyInputToMinor(value: string, currency: string): string {
  const normalized = value.trim().replace(/,/g, '.').replace(/[^0-9.]/g, '');
  if (!normalized) return '0';
  if (currency === 'IRT' || currency === 'IRR') {
    const whole = normalized.split('.')[0] || '0';
    return whole.replace(/^0+(?=\d)/, '') || '0';
  }
  const [wholeRaw, fractionRaw = ''] = normalized.split('.');
  const whole = wholeRaw || '0';
  const fraction = fractionRaw.slice(0, 2).padEnd(2, '0');
  return (BigInt(whole || '0') * 100n + BigInt(fraction || '0')).toString();
}

function prettyMarketLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  const labels: Record<string, string> = {
    h2h: 'Match winner',
    h2h_lay: 'Match winner (Lay)',
    totals: 'Total',
    spreads: 'Handicap',
    outrights: 'Outright',
    draw_no_bet: 'Draw no bet',
    btts: 'Both teams to score',
  };

  return labels[normalized] || value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BetSlipRail() {
  const { t, locale, session } = useApp();
  const [betSlipHydrated, setBetSlipHydrated] = useState(false);

  useEffect(() => {
    setBetSlipHydrated(true);
  }, []);
  const slip = useBetSlip();
  const currentContext = quoteContextFingerprint({
    userId: session?.user?.id ?? null,
    currency: session?.user?.currency ?? 'USD',
    stakeMinor: slip.stakeMinor,
    fundingSource: slip.fundingSource,
    bonusGrantId: slip.bonusGrantId,
    items: slip.items,
  });
  const submittingRef = useRef(false);
  const lastPlacementRef = useRef<{ intent: string; key: string } | null>(null);
  const pathname = usePathname();
  const showFloatingBetslip = pathname === "/" || pathname === "/live" || pathname === "/topbets" || pathname === "/search" || pathname.startsWith("/sports/") || pathname.startsWith("/match/");
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    const sync = () => {
      const d = document.body.dataset;
      setOverlayOpen(
        d.novaPageShellMenu === "1" ||
        d.novaPageShellProfile === "1" ||
        d.novaHomeMenu === "1" ||
        d.novaHomeProfile === "1" ||
        d.novaAuthSheet === "1"
      );
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "data-nova-page-shell-menu",
        "data-nova-page-shell-profile",
        "data-nova-home-menu",
        "data-nova-home-profile",
        "data-nova-auth-sheet",
      ],
    });
    return () => observer.disconnect();
  }, []);
  // Open = the user asked for it from a dedicated control and has not closed it since.
  const visible = useMemo(() => slip.isOpen && !slip.userClosed, [slip.isOpen, slip.userClosed]);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pendingQuoteState, setPendingQuoteState] = useState<QuoteResponse['quote'] | null>(
    readStoredPendingQuote,
  );
  const setPendingQuote = useCallback((quote: QuoteResponse['quote'] | null) => {
    // Re-evaluate against the current store, not a stale render closure.
    const current = useBetSlip.getState();
    const scoped = quote ? {
      ...quote,
      contextKey: quoteContextFingerprint({
        userId: session?.user?.id ?? null,
        currency: session?.user?.currency ?? 'USD',
        stakeMinor: current.stakeMinor,
        fundingSource: current.fundingSource,
        bonusGrantId: current.bonusGrantId,
        items: current.items,
      }),
    } : null;
    setPendingQuoteState(scoped);
    persistPendingQuote(scoped);
  }, [session?.user?.id, session?.user?.currency]);
  const pendingQuote = isCurrentQuote(pendingQuoteState, currentContext)
    ? pendingQuoteState : null;

  const stake = BigInt(slip.stakeMinor || '0');

  const combinedOdds = useMemo(() => {
    if (pendingQuote?.combinedOddsScaled) {
      return BigInt(pendingQuote.combinedOddsScaled);
    }
    if (slip.items.length === 0) return 0n;
    const numerator = slip.items.reduce((acc, item) => acc * BigInt(item.oddsScaled), 1n);
    const denominator = 10_000n ** BigInt(slip.items.length - 1);
    return numerator / denominator;
  }, [pendingQuote, slip.items]);

  const potentialPayout = useMemo(() => {
    if (pendingQuote?.potentialPayoutMinor) {
      return BigInt(pendingQuote.potentialPayoutMinor);
    }
    return (combinedOdds * stake) / 10_000n;
  }, [pendingQuote, combinedOdds, stake]);

  useEffect(() => {
    if (
      !slip.isOpen ||
      !session?.authenticated ||
      slip.items.length === 0 ||
      pendingQuote
    ) {
      return;
    }

    let cancelled = false;
    let checking = false;

    const checkForOddsChanges = async () => {
      if (cancelled || checking) return;
      checking = true;

      try {
        const currency = session?.user?.currency ?? 'USD';
        const type = slip.items.length > 1 ? 'MULTIPLE' : 'SINGLE';

        const result = await apiRequest<QuoteResponse>('/api/v1/bets/quote', {
          method: 'POST',
          json: {
            type,
            stakeMinor: slip.stakeMinor,
            currency,
            legs: slip.items.map((item) => ({
              matchId: item.matchId,
              marketId: item.marketId,
              selectionId: item.selectionId,
              clientOddsScaled: item.oddsScaled,
              marketVersion: item.oddsVersionSeen,
              acceptOddsChange: true,
            })),
            acceptWarnings: true,
          },
        });

        if (cancelled) return;
        const current = useBetSlip.getState();
        if (quoteContextFingerprint({
          userId: session?.user?.id ?? null,
          currency: session?.user?.currency ?? 'USD',
          stakeMinor: current.stakeMinor,
          fundingSource: current.fundingSource,
          bonusGrantId: current.bonusGrantId,
          items: current.items,
        }) !== currentContext) return;

        const freshQuote = result.quote;

        if (
          freshQuote?.quoteToken &&
          freshQuote.quoteToken.length >= 10 &&
          freshQuote.expiresAt &&
          new Date(freshQuote.expiresAt).getTime() > Date.now() &&
          Array.isArray(freshQuote.oddsChanges) &&
          freshQuote.oddsChanges.length > 0
        ) {
          setPendingQuote(freshQuote);
          setQuoteError(t('betslip.oddsChanged'));
          slip.setError(t('betslip.oddsChanged'));
        }
      } catch {
        // Background odds detection must never break the Bet Slip.
      } finally {
        checking = false;
      }
    };

    void checkForOddsChanges();
    const timer = window.setInterval(checkForOddsChanges, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    slip.isOpen,
    slip.items.length,
    slip.stakeMinor,
    session?.authenticated,
    session?.user?.currency,
    session?.user?.id,
    currentContext,
    pendingQuote,
    setPendingQuote,
    slip,
    t,
  ]);

  const place = useCallback(async () => {
    if (submittingRef.current) return;
    if (!session?.authenticated) {
      window.location.href = '/auth/login';
      return;
    }

    submittingRef.current = true;
    slip.setSubmitting(true);
    setQuoteError(null);

    const currency = session?.user?.currency ?? 'USD';
    const type = slip.items.length > 1 ? 'MULTIPLE' : 'SINGLE';
    const contextAtStart = currentContext;

    try {
      let quote = pendingQuote;

      const hasValidQuoteToken = (candidate: QuoteResponse['quote'] | null): candidate is QuoteResponse['quote'] =>
        Boolean(
          candidate?.quoteToken &&
          candidate.quoteToken.length >= 10 &&
          candidate.expiresAt &&
          new Date(candidate.expiresAt).getTime() > Date.now(),
        );

      const requestFreshQuote = async (
        clientOddsBySelection?: Map<string, string>,
      ): Promise<QuoteResponse['quote']> => {
        const quoteResult = await apiRequest<QuoteResponse>('/api/v1/bets/quote', {
          method: 'POST',
          json: {
            type,
            stakeMinor: slip.stakeMinor,
            currency,
            legs: slip.items.map((item) => ({
              matchId: item.matchId,
              marketId: item.marketId,
              selectionId: item.selectionId,
              clientOddsScaled:
                clientOddsBySelection?.get(item.selectionId) ?? item.oddsScaled,
              marketVersion: item.oddsVersionSeen,
              acceptOddsChange: true,
            })),
            acceptWarnings: true,
          },
        });

        const freshQuote = quoteResult.quote;

        if (!hasValidQuoteToken(freshQuote)) {
          throw new Error('Invalid quote token');
        }

        return freshQuote;
      };

      if (pendingQuote) {
        if (!hasValidQuoteToken(pendingQuote)) {
          setPendingQuote(null);
          quote = await requestFreshQuote();

          if (quote.oddsChanges?.length) {
            setPendingQuote(quote);
            setQuoteError(t('betslip.oddsChanged'));
            slip.setError(t('betslip.oddsChanged'));
            slip.setSubmitting(false);
            return;
          }
        } else {
          quote = pendingQuote;
        }
      } else if (!hasValidQuoteToken(quote)) {
        quote = await requestFreshQuote();

        if (quote.oddsChanges?.length) {
          setPendingQuote(quote);
          setQuoteError(t('betslip.oddsChanged'));
          slip.setError(t('betslip.oddsChanged'));
          slip.setSubmitting(false);
          return;
        }
      }

      if (!quote) {
        throw new Error('Missing quote');
      }

      const acceptedOdds: Record<string, string> = {};
      const acceptedChanges = new Map<string, string>();

      for (const change of quote.oddsChanges ?? []) {
        acceptedOdds[change.selectionId] = change.currentOddsScaled;
        acceptedChanges.set(change.selectionId, change.currentOddsScaled);
        // Never overwrite the original user-visible quote before commit.
        // A failed request must preserve the odds that require acceptance.
      }

      const payload = {
        type,
        stakeMinor: slip.stakeMinor,
        currency,
        fundingSource: slip.fundingSource,
        bonusGrantId: slip.bonusGrantId,
        legs: slip.items.map((item) => {
          const acceptedOddsScaled = acceptedChanges.get(item.selectionId);
          return {
            matchId: item.matchId,
            marketId: item.marketId,
            selectionId: item.selectionId,
            clientOddsScaled: acceptedOddsScaled ?? item.oddsScaled,
            marketVersion:
              quote.oddsChanges?.find(
                (change) => change.selectionId === item.selectionId,
              )?.currentOddsVersion ?? item.oddsVersionSeen,
            acceptOddsChange: true,
          };
        }),
        quoteToken: quote.quoteToken,
        acceptedOdds,
        acceptWarnings: true,
      };

      const current = useBetSlip.getState();
      const fingerprintInput = {
        userId: session?.user?.id ?? null,
        currency,
        stakeMinor: current.stakeMinor,
        fundingSource: current.fundingSource,
        bonusGrantId: current.bonusGrantId,
        items: current.items,
      };
      if (quoteContextFingerprint(fingerprintInput) !== contextAtStart) {
        throw new ApiClientError('BETSLIP_CHANGED', 'Your bet slip changed while pricing; please try again.', 409);
      }
      const intent = placementIntentFingerprint(fingerprintInput);
      // Keep the same Idempotency-Key when a network request may have
      // committed successfully but its response was lost.
      const previous = lastPlacementRef.current;
      const idempotencyKey = previous?.intent === intent ? previous.key : crypto.randomUUID();
      lastPlacementRef.current = { intent, key: idempotencyKey };

      const result = await apiRequest<{ bet: { publicId: string }; balanceAfterMinor: string }>('/api/v1/bets', {
        method: 'POST',
        json: payload,
        idempotencyKey,
      });

      lastPlacementRef.current = null;
      slip.setSuccess(t('betslip.accepted'));
      slip.clear();
      setPendingQuote(null);
      window.location.href = `/bets?highlight=${result.bet.publicId}`;
    } catch (error) {
      if (error instanceof ApiClientError && (error.code === 'ODDS_CHANGED' || error.code === 'STALE_ODDS' || error.code === 'ODDS_EXPIRED')) {
        const details = error.details as {
          oddsChanges?: QuoteResponse['quote']['oddsChanges'];
          quoteToken?: string;
          potentialPayoutMinor?: string;
          combinedOddsScaled?: string;
        } | undefined;
        const oddsChanges = details?.oddsChanges ?? [];

        if (details?.quoteToken && details.quoteToken.length >= 10) {
          const nextQuote = {
            combinedOddsScaled: details?.combinedOddsScaled ?? '0',
            potentialPayoutMinor: details?.potentialPayoutMinor ?? '0',
            warnings: [t('betslip.oddsChanged')],
            oddsChanges,
            quoteToken: details.quoteToken,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          };
          setPendingQuote(nextQuote);
          setQuoteError(t('betslip.oddsChanged'));
          slip.setError(t('betslip.oddsChanged'));
        } else {
          try {
            const refreshedQuoteResult = await apiRequest<QuoteResponse>('/api/v1/bets/quote', {
              method: 'POST',
              json: {
                type,
                stakeMinor: slip.stakeMinor,
                currency,
                legs: slip.items.map((item) => ({
                  matchId: item.matchId,
                  marketId: item.marketId,
                  selectionId: item.selectionId,
                  clientOddsScaled: item.oddsScaled,
                  marketVersion: item.oddsVersionSeen,
                  acceptOddsChange: true,
                })),
                acceptWarnings: true,
              },
            });

            const refreshedQuote = refreshedQuoteResult.quote;

            if (
              refreshedQuote?.quoteToken &&
              refreshedQuote.quoteToken.length >= 10 &&
              refreshedQuote.expiresAt &&
              new Date(refreshedQuote.expiresAt).getTime() > Date.now()
            ) {
              if (refreshedQuote.oddsChanges?.length) {
                setPendingQuote(refreshedQuote);
                setQuoteError(t('betslip.oddsChanged'));
                slip.setError(t('betslip.oddsChanged'));
              } else {
                setPendingQuote(null);
                setQuoteError(null);
                slip.setError(null);
              }
            } else {
              setPendingQuote(null);
              setQuoteError(t('betslip.oddsChanged'));
              slip.setError(t('betslip.oddsChanged'));
            }
          } catch {
            setPendingQuote(null);
            setQuoteError(t('betslip.oddsChanged'));
            slip.setError(t('betslip.oddsChanged'));
          }
        }
      } else if (error instanceof ApiClientError) {
        setQuoteError(error.message);
        slip.setError(error.message);
      } else {
        setQuoteError(t('common.error'));
        slip.setError(t('common.error'));
      }
      slip.setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  }, [pendingQuote, session, setPendingQuote, slip, t, currentContext]);
  // The mobile sheet renders whenever the slip is open - an empty slip shows its own empty
  // state instead of the control appearing to do nothing on a phone.
  const isMobileSheet = slip.isOpen;

  return typeof document !== 'undefined' ? createPortal(
    <>
      {!visible && showFloatingBetslip ? (
        slip.items.length === 0 ? (
          <button
            type="button"
            onClick={() => slip.openFromControl()}
            aria-label="Open Bet Slip"
            data-testid="floating-betslip-control"
            className={`fixed bottom-[68px] left-1/2 z-[2147483647] grid h-[44px] w-[44px] -translate-x-1/2 place-items-center rounded-full border border-[#24303A] bg-[#071217]/95 text-[#00D878] shadow-[0_8px_24px_rgba(0,0,0,.32),0_0_16px_rgba(0,216,120,.10)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out active:scale-[.94] md:bottom-6 md:left-auto md:end-6 md:translate-x-0 ${overlayOpen ? "pointer-events-none scale-75 opacity-0" : "scale-100 opacity-100"}`}
          >
            <Receipt size={18} strokeWidth={2.1} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => slip.openFromControl()}
            aria-label="Open Bet Slip"
            data-testid="floating-betslip-control"
            className={`fixed bottom-[68px] left-1/2 z-[2147483647] flex h-[44px] -translate-x-1/2 items-center overflow-hidden rounded-[14px] border border-[#24303A] bg-[#071217]/95 pl-1.5 pr-1 text-white shadow-[0_8px_24px_rgba(0,0,0,.32),0_0_16px_rgba(0,216,120,.10)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out active:scale-[.97] md:bottom-6 md:left-auto md:end-6 md:translate-x-0 ${overlayOpen ? "pointer-events-none scale-75 opacity-0" : "scale-100 opacity-100"}`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#00D878]/12 text-[#00D878] ring-1 ring-inset ring-[#00D878]/20">
              <Receipt size={17} strokeWidth={2.1} />
            </span>
            <span className="flex min-w-[82px] flex-col justify-center px-3 text-left leading-none">
              <span className="text-[13px] font-extrabold tracking-[-.01em]">Bet Slip</span>
              <span className="mt-1.5 text-[10px] font-semibold text-[#7F8C96]">
                {slip.items.length} {slip.items.length === 1 ? "pick" : "picks"}
              </span>
            </span>
            <span className="flex h-9 min-w-[56px] items-center justify-center gap-1 rounded-[11px] bg-white px-2 text-[14px] font-black text-[#11161A] shadow-sm">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="2.25" stroke="#00D878" strokeWidth="1.8" />
          <path d="M3.8 9.1h16.4" stroke="#00D878" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="13.55" r="2.55" stroke="#00D878" strokeWidth="1.6" />
          <path d="M12 11.85v3.4M10.95 12.7c.28-.3.65-.48 1.08-.48.62 0 1.05.32 1.05.78 0 .52-.5.68-1.08.82-.57.14-1.05.3-1.05.81 0 .47.43.77 1.08.77.46 0 .87-.15 1.14-.43" stroke="#00D878" strokeWidth="1.05" strokeLinecap="round" />
        </svg>
        {formatOddsScaled(combinedOdds.toString())}
            </span>
          </button>
        )
      ) : null}
      {/* Desktop rail */}
      <aside
        style={{
          display: visible ? undefined : 'none',
          opacity: overlayOpen ? 0 : 1,
          transform: overlayOpen ? 'translateX(24px)' : 'translateX(0)',
          pointerEvents: overlayOpen ? 'none' : undefined,
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        }}
        className="nova-betslip-rail fixed end-0 top-14 z-[2147483649] hidden h-[calc(100dvh-56px)] w-[370px] overflow-y-auto border-s border-[#E2E4E8] bg-white p-3 shadow-[-8px_0_30px_rgba(0,0,0,.06)] md:block"
        aria-label={t('betslip.title')} data-testid="betslip-rail" data-betslip-panel="rail"
      >
        <BetSlipBody
          quoteError={quoteError} pendingQuote={pendingQuote} combinedOdds={combinedOdds} potentialPayout={potentialPayout}
          onPlace={place} onDismissQuote={() => { setPendingQuote(null); setQuoteError(null); }}
        />
      </aside>

      {/* Mobile bottom sheet */}
      {isMobileSheet ? (
        <>
          <div
            className="fixed inset-0 bottom-0 z-[2147483648] bg-black/65 backdrop-blur-[1.5px] transition-opacity duration-200 ease-out md:hidden"
            aria-hidden="true"
            onClick={() => slip.close()}
            style={{ opacity: overlayOpen ? 0 : 1 }}
          />
          <div
            className={`nova-betslip-sheet fixed inset-x-0 bottom-0 z-[2147483649] transition-[opacity,transform] duration-200 ease-out md:hidden ${
              overlayOpen ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
            data-testid="betslip-sheet"
            data-betslip-panel="sheet"
            aria-label={t('betslip.title')}
          >
            <div className="h-auto overflow-hidden rounded-t-[22px] border-t border-[#E1E3E7] bg-white px-3 pb-2 shadow-[0_-18px_50px_rgba(0,0,0,.28)]">
              <BetSlipBody
                quoteError={quoteError}
                pendingQuote={pendingQuote}
                combinedOdds={combinedOdds}
                potentialPayout={potentialPayout}
                onPlace={place}
                onDismissQuote={() => {
                  setPendingQuote(null);
                  setQuoteError(null);
                }}
              />
            </div>
          </div>
        </>
      ) : null}
      </>,
    document.body,
  ) : null;
}

function BetSlipBody({
  quoteError, pendingQuote, combinedOdds, potentialPayout, onPlace, onDismissQuote,
}: {
  quoteError: string | null;
  pendingQuote: QuoteResponse['quote'] | null;
  combinedOdds: bigint;
  potentialPayout: bigint;
  onPlace: () => void;
  onDismissQuote: () => void;
}) {
  const { t, locale, session } = useApp();
  const slip = useBetSlip();
  const currency = session?.user?.currency ?? 'USD';
  const minStakeMinor = currency === 'USD' || currency === 'EUR' || currency === 'GBP' ? 10n : currency === 'IRR' ? 100000n : 10000n;
  const stakeBelowMinimum = BigInt(slip.stakeMinor || '0') > 0n && BigInt(slip.stakeMinor || '0') < minStakeMinor;
  const minStakeLabel = formatMinor(minStakeMinor, currency, locale);
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);
  const [bonusItems, setBonusItems] = useState<Array<{
    id: string;
    currency: string;
    amountMinor: string;
    remainingAmountMinor: string;
    status: string;
    expiresAt: string;
  }>>([]);
  const [bonusLoading, setBonusLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const viewMode: 'SINGLE' | 'MULTIPLE' = slip.items.length > 1 ? 'MULTIPLE' : 'SINGLE';
  const [betCode, setBetCode] = useState('');
  const [stakeInput, setStakeInput] = useState(() => moneyInputFromMinor(slip.stakeMinor, currency));

  const loadBalance = useCallback(async () => {
    if (!session?.authenticated || !session?.user?.currency) {
      setBalanceMinor(null);
      return;
    }
    setBalanceLoading(true);
    try {
      const result = await apiRequest<{
        wallet: {
          balanceMinor: string | number | bigint;
          heldMinor: string | number | bigint;
          availableMinor: string | number | bigint;
        };
      }>(
        `/api/v1/wallet?currency=${encodeURIComponent(session.user.currency)}`,
        { method: 'GET' },
      );
      setBalanceMinor(String(result.wallet.availableMinor));
    } catch {
      setBalanceMinor(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [session?.authenticated, session?.user?.currency]);

  const stakeInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!stakeInputFocusedRef.current) {
      setStakeInput(moneyInputFromMinor(slip.stakeMinor, currency));
    }
  }, [currency, slip.stakeMinor]);

  useEffect(() => {
    void loadBalance();
    if (!session?.authenticated) return;
    const interval = window.setInterval(() => {
      void loadBalance();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadBalance, session?.authenticated]);

  useEffect(() => {
    let cancelled = false;

    const loadBonuses = async () => {
      if (!session?.authenticated || !session?.user?.currency) {
        setBonusItems([]);
        setBonusLoading(false);
        return;
      }

      setBonusLoading(true);
      try {
        const result = await apiRequest<{
          items: Array<{
            id: string;
            currency: string;
            amountMinor: string;
            remainingAmountMinor: string;
            status: string;
            expiresAt: string;
          }>;
        }>(
          `/api/v1/bonuses?currency=${encodeURIComponent(session.user.currency)}&status=active`,
          { method: 'GET' },
        );

        const now = Date.now();
        const active = (result.items ?? []).filter((item) => (
          item.status === 'active' &&
          BigInt(item.remainingAmountMinor || '0') > 0n &&
          new Date(item.expiresAt).getTime() > now &&
          item.currency === session?.user?.currency
        ));

        if (!cancelled) {
          setBonusItems(active);
          if (
            slip.fundingSource === 'bonus' &&
            slip.bonusGrantId &&
            !active.some((item) => item.id === slip.bonusGrantId)
          ) {
            slip.setFundingSource('main');
            slip.setBonusGrantId(null);
          }
        }
      } catch {
        if (!cancelled) setBonusItems([]);
      } finally {
        if (!cancelled) setBonusLoading(false);
      }
    };

    void loadBonuses();

    const interval = window.setInterval(() => {
      void loadBonuses();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session?.authenticated, session?.user?.currency, slip.fundingSource, slip.bonusGrantId]);

  useEffect(() => {
    const nextMode: 'SINGLE' | 'MULTIPLE' = slip.items.length > 1 ? 'MULTIPLE' : 'SINGLE';
    if (slip.mode !== nextMode) slip.setMode(nextMode);
  }, [slip.items.length, slip.mode, slip.setMode]);

  const selectMode = (_mode: 'SINGLE' | 'MULTIPLE' | 'SERIES') => {};

  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const createShareCode = useCallback(async () => {
    if (slip.items.length === 0 || shareLoading) return;
    setShareLoading(true);
    setShareError(null);
    setShareCopied(false);
    try {
      const result = await apiRequest<{ code: string }>("/api/v1/betslip/share", {
        method: "POST",
        body: JSON.stringify({ type: viewMode === "SINGLE" ? "SINGLE" : "MULTIPLE", currency, selections: slip.items }),
      });
      setShareCode(result.code);
    } catch (error) {
      setShareError(error instanceof ApiClientError ? error.message : "Unable to create bet slip code");
    } finally {
      setShareLoading(false);
    }
  }, [currency, shareLoading, slip.items, viewMode]);

  const loadShareCode = useCallback(async () => {
    const code = betCode.trim().toUpperCase();
    if (!code || shareLoading) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const result = await apiRequest<{ code: string; type: "SINGLE" | "MULTIPLE" | "SERIES"; legs: Array<{ matchId: string; marketId: string; selectionId: string; sportSlug: string; available: boolean; current: { label: string; marketLabel: string; matchLabel: string; oddsScaled: string; oddsVersion: number } | null }>; availableCount: number; unavailableCount: number }>(`/api/v1/betslip/share/${encodeURIComponent(code)}`, { method: "GET" });
      const items = result.legs.filter((leg) => leg.available && leg.current !== null).map((leg) => ({ selectionId: leg.selectionId, marketId: leg.marketId, matchId: leg.matchId, label: leg.current!.label, marketLabel: leg.current!.marketLabel, matchLabel: leg.current!.matchLabel, sportSlug: leg.sportSlug, oddsScaled: leg.current!.oddsScaled, oddsVersionSeen: leg.current!.oddsVersion, addedAt: Date.now() }));
      if (items.length === 0) {
        setShareError("No selections from this bet slip are currently available");
        return;
      }
      slip.replaceItems(items, result.type === "SINGLE" ? "SINGLE" : "MULTIPLE");
      setBetCode("");
      if (result.unavailableCount > 0) setShareError(`${result.unavailableCount} selection${result.unavailableCount === 1 ? "" : "s"} unavailable`);
    } catch (error) {
      setShareError(error instanceof ApiClientError ? error.message : "Unable to load bet slip code");
    } finally {
      setShareLoading(false);
    }
  }, [betCode, shareLoading, slip]);
  const copyShareCode = useCallback(async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setShareError("Unable to copy bet slip code");
    }
  }, [shareCode]);
  return (
    <div className="relative text-[#15171B]">
      <style jsx>{`@keyframes shareCardIn { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      {shareLoading || shareCode ? (
        <div className="absolute inset-x-3 top-12 z-50 rounded-[18px] animate-[shareCardIn_180ms_ease-out] border border-[#E1E4E9] bg-white p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-extrabold text-[#15171B]">Share bet slip</span>
            <button type="button" onClick={() => { setShareCode(null); setShareCopied(false); }} className="grid h-8 w-8 place-items-center rounded-full bg-[#F0F1F4] text-[#737A84]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-[14px] bg-[#F3F4F7] p-2">
            <div className="min-w-0 flex-1 truncate px-2 text-[15px] font-extrabold tracking-[0.08em] text-[#15171B]">{shareCode || "Generating…"}</div>
            <button type="button" onClick={copyShareCode} className="h-10 shrink-0 rounded-[11px] bg-[#1481F2] px-4 text-[13px] font-extrabold text-white">{shareCopied ? "Copied" : "Copy"}</button>
          </div>
          <div className="mt-2 text-[12px] text-[#7B838D]">Anyone with this code can load the current selections and latest available odds.</div>
        </div>
      ) : null}
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-3 flex h-[44px] items-center justify-between border-b border-[#E4E6EA] bg-[#F3F4F7] px-4">
        <button
          type="button"
          onClick={() => slip.close()}
          className="flex items-center gap-2 text-[14px] font-extrabold text-[#17191D]"
          aria-label={t('betslip.close')}
          data-testid="betslip-close"
        >
          <ChevronDown className="h-6 w-6" strokeWidth={2.5} />
          <span>{t('betslip.title')}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {session?.authenticated ? (
            <div className="flex items-center gap-1.5 text-[15px] font-extrabold text-[#202329]">
              <WalletCards className="h-[19px] w-[19px] text-[#7D8795]" strokeWidth={2} />
              <span>
                {balanceLoading && balanceMinor === null
                  ? '0.00'
                  : balanceMinor !== null
                    ? formatMinor(balanceMinor, currency, locale)
                    : '0.00'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2 pt-2">
        {shareError ? <div role="alert" className="mx-3 rounded-[14px] border border-[#F3B7BE] bg-[#FFF1F3] px-3 py-2 text-[13px] font-bold leading-5 text-[#C6283D]">{shareError}</div> : null}
        {slip.items.length === 0 ? (
          <div className="flex min-h-[290px] flex-col items-center justify-center px-3 pb-2 text-center">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#EAF2FF]">
              <IdCard className="h-9 w-9 text-[#147BEF]" strokeWidth={2} />
            </div>

            <h3 className="max-w-[260px] text-[23px] font-extrabold leading-tight text-[#15171B]">
              Select an outcome
              <br />
              to place a bet
            </h3>

            <div className="mt-9 flex w-full items-center gap-3">
              <input
                value={betCode}
                onChange={(event) => setBetCode(event.target.value)}
                placeholder="Bet code"
                aria-label="Bet code"
                className="h-[54px] min-w-0 flex-1 rounded-[17px] border border-[#E1E4E9] bg-[#F0F1F4] px-4 text-[16px] font-medium text-[#202329] outline-none transition focus:border-[#1481F2] focus:bg-white"
              />
              <button
                type="button"
                disabled={!betCode.trim() || shareLoading}
                className="h-[54px] rounded-[17px] bg-[#71D6A4] px-6 text-[14px] font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                onClick={loadShareCode}
              >
                View bet
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Selection tabs */}
            <div className="flex items-center gap-3">
              <div className="grid flex-1 grid-cols-3 rounded-[12px] bg-[#ECEEF2] p-1">
                {([
                  ['SINGLE', 'Single'],
                  ['MULTIPLE', 'Multiple'],
                  ['SERIES', 'Series'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (slip.fundingSource === 'bonus') {
                        if (mode === 'MULTIPLE') selectMode('MULTIPLE');
                        return;
                      }
                      selectMode(mode);
                    }}
                    disabled={mode === 'SERIES' || (slip.fundingSource === 'bonus' && mode !== 'MULTIPLE')}
                    className={`h-[36px] rounded-[10px] text-[13px] font-bold transition ${
                      viewMode === mode
                        ? 'bg-[#1684F5] text-white shadow-[0_2px_5px_rgba(0,0,0,.14)]'
                        : 'text-[#202329]'
                    }`}
                    aria-pressed={viewMode === mode}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => slip.clear()}
                aria-label={t('betslip.clear')}
                className="grid h-[42px] w-[44px] shrink-0 place-items-center rounded-[12px] bg-[#ECEEF2] text-[#858D99] transition hover:bg-[#E4E6EA] hover:text-[#535B67]"
              >
                <Trash2 className="h-6 w-6" strokeWidth={2.1} />
              </button>
            </div>

            {/* Selection cards */}
            <ul className="space-y-2.5">
              {slip.items.map((item) => {
                const change = pendingQuote?.oddsChanges.find(
                  (c) => c.selectionId === item.selectionId,
                );

                return (
                  <li
                    key={item.selectionId}
                    className="rounded-[13px] border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,.03)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#F2E9FF] text-[10px] font-black text-[#D0008B]">
                            •
                          </span>
                          <span className="text-[12px] font-bold text-[#4B515B]">
                            {item.matchLabel}
                          </span>
                        </div>

                        <div className="mt-1.5 truncate text-[13px] font-extrabold text-[#181A1E]">
                          {prettyMarketLabel(item.marketLabel)} · {item.label}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        <span className={`rounded-[9px] px-2.5 py-1 text-[13px] font-extrabold text-white ${
                  change
                    ? 'bg-[#08B94E] shadow-[0_2px_6px_rgba(8,185,78,.18)]'
                    : 'bg-[#1684F5]'
                }`}>
                  {formatOddsScaled(change?.currentOddsScaled ?? item.oddsScaled)}
                </span>

                        <button
                          type="button"
                          onClick={() => slip.remove(item.selectionId)}
                          aria-label={t('betslip.remove')}
                          className="mt-0.5 grid h-7 w-7 place-items-center text-[#6F7680] transition hover:text-[#E44B5D]"
                        >
                          <X className="h-5 w-5" strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Funding account */}
            <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-3">
              <div className="mb-2 text-[12px] font-extrabold text-[#69717C]">
                Betting account
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    slip.setFundingSource('main');
                    slip.setBonusGrantId(null);
                  }}
                  className={`min-h-[46px] rounded-[12px] border px-3 text-left transition ${
                    slip.fundingSource === 'main'
                      ? 'border-[#1684F5] bg-[#EEF6FF] text-[#1684F5]'
                      : 'border-[#E1E4E9] bg-[#F7F8FA] text-[#4D5560]'
                  }`}
                  aria-pressed={slip.fundingSource === 'main'}
                >
                  <div className="text-[13px] font-extrabold">Main Account</div>
                  <div className="mt-0.5 text-[10px] font-semibold opacity-70">
                    Use your cash balance
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    slip.setFundingSource('bonus');
                    if (bonusItems.length > 0) {
                      const selected = bonusItems.find((item) => item.id === slip.bonusGrantId) ?? bonusItems[0];
                      if (!selected) return;
                      slip.setBonusGrantId(selected.id);
                      slip.setMode('MULTIPLE');
                      slip.setStake(selected.remainingAmountMinor);
                      setStakeInput(moneyInputFromMinor(selected.remainingAmountMinor, currency));
                    }
                  }}
                  disabled={!session?.authenticated || bonusItems.length === 0}
                  className={`min-h-[46px] rounded-[12px] border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    slip.fundingSource === 'bonus'
                      ? 'border-[#C35CFF] bg-[#FBF2FF] text-[#A12BD0]'
                      : 'border-[#E1E4E9] bg-[#F7F8FA] text-[#4D5560]'
                  }`}
                  aria-pressed={slip.fundingSource === 'bonus'}
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                    <Gift className="h-4 w-4" />
                    Bonus Account
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold opacity-70">
                    {bonusLoading ? 'Loading bonuses…' : `${bonusItems.length} active bonus${bonusItems.length === 1 ? '' : 'es'}`}
                  </div>
                </button>
              </div>

              {slip.fundingSource === 'bonus' ? (
                <div className="mt-3 space-y-2">
                  {bonusItems.length > 0 ? (
                    <select
                      value={slip.bonusGrantId ?? ''}
                      onChange={(event) => {
                        const id = event.target.value;
                        const selected = bonusItems.find((item) => item.id === id);
                        slip.setBonusGrantId(id || null);
                        slip.setMode('MULTIPLE');
                        if (selected) {
                          slip.setStake(selected.remainingAmountMinor);
                          setStakeInput(moneyInputFromMinor(selected.remainingAmountMinor, currency));
                        }
                      }}
                      className="h-[44px] w-full rounded-[12px] border border-[#E1E4E9] bg-[#F7F8FA] px-3 text-[13px] font-bold text-[#202329] outline-none focus:border-[#C35CFF] focus:bg-white"
                      aria-label="Select bonus"
                    >
                      {bonusItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {formatMinor(item.remainingAmountMinor, currency, locale)} · expires {new Date(item.expiresAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-[12px] border border-[#F3B7BE] bg-[#FFF1F3] px-3 py-2 text-[12px] font-bold leading-5 text-[#C6283D]">
                      No active bonus is available for this currency.
                    </div>
                  )}

                  <div className="rounded-[12px] border border-[#DCC6E8] bg-[#FCF7FF] px-3 py-2.5 text-[12px] font-semibold leading-5 text-[#5D4A67]">
                    <div className="font-extrabold text-[#A12BD0]">Bonus requirements</div>
                    <div>• Accumulator only.</div>
                    <div>• Exactly 4 selections.</div>
                    <div>• Minimum odds 1.60 per selection.</div>
                    <div>• Stake must equal the bonus amount.</div>
                  </div>
                </div>
              ) : null}
            </div>
            {slip.lastError ? (
              <div
                role="alert"
                className="rounded-[16px] border border-[#F3B7BE] bg-[#FFF1F3] px-4 py-3 text-[14px] font-bold leading-5 text-[#C6283D]"
                data-testid="betslip-error"
              >
                {slip.lastError}
              </div>
            ) : null}
            {/* Bet amount */}
            <div className="space-y-2">
              <div className="relative">
                  <label
                    htmlFor="betslip-stake"
                    className="sr-only"
                  >
                    {t('betslip.stake')}
                  </label>
                  <input
                    id="betslip-stake"
                    readOnly={slip.fundingSource === 'bonus'}
                    inputMode={currency === 'IRT' || currency === 'IRR' ? 'numeric' : 'decimal'}
                    value={stakeInput}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (currency === 'IRT' || currency === 'IRR') {
                        if (!/^\d*$/.test(value)) return;
                      } else {
                        if (!/^\d*(\.\d{0,2})?$/.test(value)) return;
                      }
                      setStakeInput(value);
                      slip.setStake(value === '' ? '0' : moneyInputToMinor(value, currency));
                    }}
                    onFocus={() => {
                      stakeInputFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      stakeInputFocusedRef.current = false;
                      setStakeInput(moneyInputFromMinor(slip.stakeMinor, currency));
                    }}
                    placeholder="Bet amount"
                    className="h-[44px] w-full rounded-[12px] border border-[#E1E4E9] bg-[#F0F1F4] px-3 pr-16 text-[13px] font-medium text-[#202329] outline-none transition focus:border-[#1684F5] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (slip.fundingSource === 'bonus') {
                        const selected = bonusItems.find((item) => item.id === slip.bonusGrantId);
                        if (selected) {
                          slip.setStake(selected.remainingAmountMinor);
                          setStakeInput(moneyInputFromMinor(selected.remainingAmountMinor, currency));
                        }
                        return;
                      }
                      if (balanceMinor !== null) {
                        slip.setStake(balanceMinor);
                        setStakeInput(moneyInputFromMinor(balanceMinor, currency));
                      }
                    }}
                    disabled={slip.fundingSource === 'bonus'
                      ? !bonusItems.some((item) => item.id === slip.bonusGrantId)
                      : balanceMinor === null}
                    className="absolute inset-y-0 end-0 px-4 text-[12px] font-extrabold text-[#1684F5] disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>

                {stakeBelowMinimum ? (
                  <p className="mt-2 px-1 text-[12px] font-bold text-[#C6283D]">
                    Minimum bet: {minStakeLabel}
                  </p>
                ) : null}
              </div>

            {/* Totals */}
            <div className="space-y-0.5 px-1">

              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#707781]">
                  Possible win
                </span>
                <span className="text-[14px] font-extrabold text-[#159A62]">
                  {slip.fundingSource === 'bonus'
                    ? formatMinor(
                        bonusItems.find((item) => item.id === slip.bonusGrantId)?.remainingAmountMinor ?? '0',
                        currency,
                        locale,
                      )
                    : formatMinor(potentialPayout, currency, locale)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={createShareCode}
                  disabled={shareLoading}
                  aria-label="Share bet slip"
                  className="group grid h-[44px] w-[46px] shrink-0 place-items-center rounded-[17px] bg-[#EEF0F3] text-[#8A929D] shadow-[0_2px_6px_rgba(0,0,0,.06)] transition-all duration-150 ease-out hover:bg-[#E5E8ED] hover:text-[#1684F5] active:scale-90 active:bg-[#DCE2EA] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Share2 className="h-6 w-6 transition-transform duration-150 ease-out group-active:scale-90" strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={onPlace}
                  disabled={
                    slip.isSubmitting ||
                    BigInt(slip.stakeMinor || '0') < minStakeMinor
                  }
                  data-testid="betslip-place"
                  className="h-[44px] flex-1 rounded-[12px] bg-[#08B94E] text-[14px] font-extrabold text-white shadow-[0_4px_10px_rgba(8,185,78,.18)] transition hover:bg-[#06AA47] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {slip.isSubmitting
                    ? t('common.loading')
                    : pendingQuote?.oddsChanges?.length
                      ? 'Accept new odds'
                      : 'Place a bet'}
                </button>
              </div>

            {!session?.authenticated ? (
              <p className="pb-1 text-center text-[12px] font-medium text-[#727983]">
                <Link
                  href="/auth/login"
                  className="font-extrabold text-[#1684F5]"
                >
                  {t('nav.login')}
                </Link>
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
