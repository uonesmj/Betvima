/**
 * BETTING SERVICE - the single orchestrator for pricing and placing bets.
 *
 * Guarantees:
 *  * client odds are never used for money; they are only compared to the authoritative
 *    database odds so the user can be asked to accept a change (OLD -> NEW, explicitly)
 *  * every quote is HMAC-signed and bound to the odds versions it was priced against,
 *    so a stale or hand-edited quote can never be replayed
 *  * the database performs the final atomic debit + insert; this service only decides
 *    whether the request may reach it
 */
import type { Services } from './container';
import type { ActorContext } from '@/lib/ports/db';
import type { Bet, BetSlipInput, CashoutQuote, Currency, PlacementQuote, UUID } from '@/lib/types';
import type { PlaceBetResult } from '@/lib/ports/repositories';
import { ApiError } from '@/lib/errors';
import { potentialPayout } from '@/domain/betslip';
import { accumulatorOddsScaled, oddsToDisplayString, type OddsScaled } from '@/domain/odds';
import { money, compare } from '@/domain/money';
import { signQuote, verifyQuote, type QuotePayload } from '@/server/utils/hash';
import { createLogger } from '@/server/logger';
import { isLiveMatchStatus } from '@/lib/match-state';

const log = createLogger({ component: 'betting-service' });

const MIN_STAKE_MINOR_BY_CURRENCY: Partial<Record<Currency, bigint>> = { IRR: 10_000n, IRT: 10_000n, USD: 10n, EUR: 10n, GBP: 10n };
const minStakeMinorForCurrency = (currency: Currency) => MIN_STAKE_MINOR_BY_CURRENCY[currency] ?? 10_000n;
const MAX_STAKE_MINOR = 500_000_000n;
const DEFAULT_MAX_PAYOUT_MINOR = 2_000_000_000n;

export interface QuoteInput { actor: ActorContext; userId: UUID; slip: BetSlipInput; currency: Currency }

interface LoadedLeg {
  selectionId: UUID; marketId: UUID; matchId: UUID; matchLabel: string; marketKey: string; marketName: string;
  selectionName: string; marketStatus: string; selectionStatus: string; matchStatus: string;
  isLive: boolean; scheduledAt: string; oddsUpdatedAt: string | null; oddsScaled: OddsScaled; oddsVersion: number;
  clientOddsScaled: OddsScaled | null; acceptOddsChange: boolean;
}

function quoteLegsForValidation(
  quote: PlacementQuote,
  slip: BetSlipInput,
): { selectionId: string; oddsScaled: bigint }[] {
  const changed = new Map(
    quote.oddsChanges.map((change) => [
      change.selectionId,
      change.currentOddsScaled,
    ]),
  );

  return slip.legs.map((leg) => ({
    selectionId: leg.selectionId,
    oddsScaled: changed.get(leg.selectionId) ?? (leg.clientOddsScaled ?? 0n),
  }));
}

export class BettingService {
  constructor(private readonly services: Services) {}

  /** Server-side price plus every odds change the user must explicitly accept. */
  async quote(input: QuoteInput): Promise<PlacementQuote> {
    const legs = await this.loadLegs(input);
    this.assertLegSet(input.slip, legs);
    if (legs.some((leg) => leg.isLive) && !(await this.featureEnabled('LIVE_BETTING'))) {
      throw new ApiError('LIVE_BETTING_DISABLED');
    }
    const maxPayout = await this.maxPayoutMinor(input.currency);
    const odds = legs.map((l) => l.oddsScaled);
    const combined = accumulatorOddsScaled(odds);
    const payout = potentialPayout(money(input.slip.stakeMinor, input.currency), odds);
    const isBonusBet = input.slip.fundingSource === 'bonus';
    const effectivePayout = isBonusBet ? input.slip.stakeMinor : payout.amount;
    if (!isBonusBet && compare(payout, money(maxPayout, input.currency)) > 0) {
      throw new ApiError('PAYOUT_ABOVE_MAXIMUM', `Potential payout exceeds the table maximum of ${maxPayout} minor units`);
    }

    const oddsChanges = legs
      .filter((l) => l.clientOddsScaled !== null && l.clientOddsScaled !== l.oddsScaled)
      .map((l) => ({
        selectionId: l.selectionId,
        previousOddsScaled: l.clientOddsScaled as OddsScaled,
        currentOddsScaled: l.oddsScaled,
        currentOddsVersion: l.oddsVersion,
        direction: (l.oddsScaled > (l.clientOddsScaled as OddsScaled) ? 'UP' : 'DOWN') as 'UP' | 'DOWN',
      }));

    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const quoteToken = signQuote({
      userId: input.userId, type: input.slip.type, stakeMinor: input.slip.stakeMinor.toString(),
      currency: input.currency, combinedOddsScaled: combined.toString(), expiresAt,
      legs: legs.map((l) => ({ selectionId: l.selectionId, oddsVersion: l.oddsVersion, oddsScaled: l.oddsScaled.toString() })),
    });

    return {
      type: input.slip.type, currency: input.currency, stakeMinor: input.slip.stakeMinor,
      combinedOddsScaled: combined, potentialPayoutMinor: effectivePayout, maxPayout,
      warnings: this.warningsFor(legs, input.slip),
      oddsChanges, quoteToken, expiresAt,
    };
  }

  /** Place a bet using the signed quote as the authoritative odds/version payload. */
  async place(input: QuoteInput & {
    idempotencyKey: string;
    quoteToken?: string | null;
    acceptedOdds?: Record<string, string>;
  }): Promise<PlaceBetResult> {
    const placementLegs = await this.loadLegs(input);
    this.assertLegSet(input.slip, placementLegs);
    if (placementLegs.some((leg) => leg.isLive) && !(await this.featureEnabled('LIVE_BETTING'))) {
      throw new ApiError('LIVE_BETTING_DISABLED');
    }

    let authoritativeLegs: {
      selectionId: string;
      marketId: string;
      matchId: string;
      clientOddsScaled: string | null;
      marketVersion: number | null;
      acceptOddsChange: boolean;
    }[];

    if (input.quoteToken) {
      let payload: QuotePayload;

      try {
        payload = verifyQuote<QuotePayload>(input.quoteToken);
      } catch (error) {
        throw new ApiError(
          'ODDS_EXPIRED',
          `Price quote rejected: ${(error as Error).message}`,
        );
      }

      const payloadLegs = Array.isArray(payload.legs) ? payload.legs : [];

      const payloadBySelection = new Map(
        payloadLegs.map((leg) => [
          String(leg.selectionId),
          {
            oddsVersion: Number(leg.oddsVersion),
            oddsScaled: String(leg.oddsScaled),
          },
        ]),
      );

      const payloadSelectionIds = payloadLegs
        .map((leg) => String(leg.selectionId))
        .sort();

      const currentSelectionIds = input.slip.legs
        .map((leg) => String(leg.selectionId))
        .sort();

      const sameSelections =
        payloadSelectionIds.length === currentSelectionIds.length &&
        payloadSelectionIds.every(
          (id, index) => id === currentSelectionIds[index],
        );

      if (
        payload.userId !== input.userId ||
        String(payload.stakeMinor) !== input.slip.stakeMinor.toString() ||
        String(payload.currency) !== input.currency ||
        String(payload.type) !== input.slip.type ||
        !sameSelections
      ) {
        throw new ApiError(
          'ODDS_EXPIRED',
          'The price quote does not belong to this customer or bet slip',
        );
      }

      if (payloadLegs.length === 0) {
        throw new ApiError(
          'ODDS_EXPIRED',
          'The signed price quote contains no selections',
        );
      }

      const acceptedOdds = input.acceptedOdds ?? {};
      const currentBySelection = new Map(
        placementLegs.map((leg) => [String(leg.selectionId), leg]),
      );

      for (const leg of input.slip.legs) {
        const signed = payloadBySelection.get(String(leg.selectionId));

        if (!signed) {
          throw new ApiError(
            'ODDS_EXPIRED',
            'The signed price quote is missing a selection',
          );
        }

        const current = currentBySelection.get(String(leg.selectionId));
        if (!current ||
          current.oddsVersion !== signed.oddsVersion ||
          current.oddsScaled.toString() !== signed.oddsScaled) {
          throw new ApiError('ODDS_CHANGED',
            'The market moved after the signed quote; request an updated price',
            {
              details: {
                selectionId: String(leg.selectionId),
                currentOddsScaled: current?.oddsScaled.toString() ?? null,
                currentOddsVersion: current?.oddsVersion ?? null,
              },
            },
          );
        }

        const clientOdds =
          leg.clientOddsScaled == null
            ? null
            : String(leg.clientOddsScaled);
        const signedOdds = signed.oddsScaled;

        if (
          clientOdds !== null &&
          clientOdds !== signedOdds &&
          acceptedOdds[String(leg.selectionId)] !== signedOdds
        ) {
          throw new ApiError(
            'ODDS_CHANGED',
            'Odds changed; explicit acceptance of the new price is required',
            {
              details: {
                selectionId: String(leg.selectionId),
                currentOddsScaled: signedOdds,
                currentOddsVersion: signed.oddsVersion,
              },
            },
          );
        }
      }

      authoritativeLegs = input.slip.legs.map((leg) => {
        const signed = payloadBySelection.get(String(leg.selectionId));

        if (!signed) {
          throw new ApiError(
            'ODDS_EXPIRED',
            'The signed price quote is missing a selection',
          );
        }

        return {
          selectionId: String(leg.selectionId),
          marketId: String(leg.marketId),
          matchId: String(leg.matchId),
          clientOddsScaled: signed.oddsScaled,
          marketVersion: signed.oddsVersion,
          // A signed, explicitly accepted quote is the final permitted price.
          // Any later movement must fail in the atomic DB transaction.
          acceptOddsChange: false,
        };
      });
    } else {
      const quote = await this.quote(input);

      if (quote.oddsChanges.length > 0) {
        throw new ApiError(
          'ODDS_CHANGED',
          'Odds moved since the selection was added; accept the new price to continue',
          {
            details: {
              oddsChanges: quote.oddsChanges.map((c) => ({
                selectionId: c.selectionId,
                previous: oddsToDisplayString(c.previousOddsScaled),
                current: oddsToDisplayString(c.currentOddsScaled),
                previousOddsScaled: c.previousOddsScaled.toString(),
                currentOddsScaled: c.currentOddsScaled.toString(),
                currentOddsVersion: c.currentOddsVersion,
                direction: c.direction,
              })),
              quoteToken: quote.quoteToken,
              potentialPayoutMinor: quote.potentialPayoutMinor.toString(),
              combinedOddsScaled: quote.combinedOddsScaled.toString(),
            },
          },
        );
      }

      const quotedBySelection = new Map(
        placementLegs.map((leg) => [
          String(leg.selectionId),
          {
            oddsScaled: leg.oddsScaled.toString(),
            oddsVersion: leg.oddsVersion,
          },
        ]),
      );

      authoritativeLegs = input.slip.legs.map((leg) => {
        const quoted = quotedBySelection.get(String(leg.selectionId));

        if (!quoted) {
          throw new ApiError(
            'ODDS_EXPIRED',
            'The quoted price is missing a selection',
          );
        }

        return {
          selectionId: String(leg.selectionId),
          marketId: String(leg.marketId),
          matchId: String(leg.matchId),
          clientOddsScaled: quoted.oddsScaled,
          marketVersion: quoted.oddsVersion,
          acceptOddsChange: false,
        };
      });
    }

    const result = await this.services.betting.placeBet({
      actor: { ...input.actor, userId: input.userId },
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      payload: {
        type: input.slip.type,
        stakeMinor: input.slip.stakeMinor.toString(),
        currency: input.currency,
        fundingSource: input.slip.fundingSource ?? 'main',
        bonusGrantId: input.slip.bonusGrantId ?? null,
        legs: authoritativeLegs,
      },
    });

    return result;
  }

  async cashoutQuote(input: { actor: ActorContext; userId: UUID; betId: UUID }): Promise<CashoutQuote> {
    const enabled = await this.featureEnabled('CASHOUT');
    if (!enabled) {
      const bet = await this.services.betting.getBet(input.actor, input.betId, input.userId);
      if (!bet) throw new ApiError('BET_NOT_FOUND');
      return {
        betId: input.betId, available: false, reason: 'FEATURE_DISABLED', offerMinor: null,
        originalStakeMinor: bet.stakeMinor, potentialPayoutMinor: bet.potentialPayoutMinor, expiresAt: null, margin: null,
      };
    }
    return this.services.betting.getCashoutQuote(input.actor, input.betId, input.userId);
  }

  async acceptCashout(input: { actor: ActorContext; userId: UUID; betId: UUID; quoteId: UUID; idempotencyKey: string }) {
    const result = await this.services.betting.acceptCashout(input.actor, {
      betId: input.betId, quoteId: input.quoteId, userId: input.userId, idempotencyKey: input.idempotencyKey,
    });
    return { ...result, replay: Boolean(result.replay) };
  }

  async cancelBet(input: { actor: ActorContext; userId: UUID; betId: UUID; reason: string }): Promise<Bet> {
    return this.services.betting.cancelBet(input.actor, input.betId, input.userId, input.reason);
  }

  async featureEnabled(key: string): Promise<boolean> {
    try {
      const operations = await this.services.admin.operations();
      return operations.find((o) => o.key === key)?.isEnabled ?? false;
    } catch (error) {
      log.warn('operation lookup failed; treating feature as disabled', { key, error: (error as Error).message });
      return false;
    }
  }

  /* ------------------------------------------------------------------ internals */

  private async loadLegs(input: QuoteInput): Promise<LoadedLeg[]> {
    const requested = input.slip.legs;
    if (requested.length === 0) throw new ApiError('BETSLIP_EMPTY');
    const byMatch = new Map<string, string[]>();
    for (const leg of requested) byMatch.set(leg.matchId, [...(byMatch.get(leg.matchId) ?? []), leg.selectionId]);

    const loaded: LoadedLeg[] = [];
    for (const [matchId, selectionIds] of byMatch) {
      const snapshots = await this.services.catalog.getSelectionsForPlacement(matchId, selectionIds);
      for (const requestedLeg of requested.filter((l) => l.matchId === matchId)) {
        const snapshot = snapshots.find((s) => s.selectionId === requestedLeg.selectionId);
        if (!snapshot) throw new ApiError('NOT_FOUND', 'One or more selections no longer exist');
        loaded.push({
          selectionId: snapshot.selectionId, marketId: snapshot.marketId, matchId: snapshot.matchId,
          matchLabel: snapshot.matchLabel, marketKey: snapshot.marketKey, marketName: snapshot.marketName,
          selectionName: snapshot.selectionName, marketStatus: snapshot.marketStatus,
          selectionStatus: snapshot.selectionStatus, matchStatus: snapshot.matchStatus,
          isLive: snapshot.isLive || isLiveMatchStatus(snapshot.matchStatus), scheduledAt: snapshot.scheduledAt, oddsUpdatedAt: snapshot.oddsUpdatedAt, oddsScaled: snapshot.oddsScaled,
          oddsVersion: snapshot.oddsVersion, clientOddsScaled: requestedLeg.clientOddsScaled,
          acceptOddsChange: requestedLeg.acceptOddsChange,
        });
      }
    }
    return loaded;
  }

  /** State, market and correlation rules - evaluated before any money is touched. */
  private assertLegSet(slip: BetSlipInput, legs: LoadedLeg[]): void {
    for (const leg of legs) {
      if (['finished', 'cancelled', 'abandoned'].includes(leg.matchStatus)) {
        throw new ApiError('MATCH_FINISHED', `${leg.matchLabel} is no longer available for betting`);
      }
      if (['postponed', 'interrupted'].includes(leg.matchStatus)) {
        throw new ApiError('MATCH_POSTPONED', `${leg.matchLabel} is currently suspended`);
      }
      if (['closed', 'settled', 'void'].includes(leg.marketStatus)) {
        throw new ApiError('MARKET_CLOSED', `${leg.marketName} is closed`);
      }
      if (leg.marketStatus !== 'open') throw new ApiError('MARKET_SUSPENDED', `${leg.marketName} is not open for betting`);
      if (leg.selectionStatus !== 'open') {
        throw new ApiError('MARKET_SUSPENDED', `${leg.selectionName} is not open for betting`);
      }
      const maxOddsAgeSeconds = leg.isLive ? 45 : 300;
      const oddsUpdatedAtMs = leg.oddsUpdatedAt ? Date.parse(leg.oddsUpdatedAt) : Number.NaN;
      if (
        !Number.isFinite(oddsUpdatedAtMs) ||
        Date.now() - oddsUpdatedAtMs > maxOddsAgeSeconds * 1000
      ) {
        throw new ApiError('STALE_ODDS', `${leg.selectionName}: odds feed is stale`);
      }
      if (leg.clientOddsScaled !== null && leg.clientOddsScaled !== leg.oddsScaled && !leg.acceptOddsChange) {
        throw new ApiError('ODDS_CHANGED', `${leg.selectionName}: odds moved from ${oddsToDisplayString(leg.clientOddsScaled)} to ${oddsToDisplayString(leg.oddsScaled)}`, {
          details: {
            selectionId: leg.selectionId, previousOddsScaled: leg.clientOddsScaled.toString(),
            currentOddsScaled: leg.oddsScaled.toString(), currentOddsVersion: leg.oddsVersion, direction: leg.oddsScaled > leg.clientOddsScaled ? 'UP' : 'DOWN',
          },
        });
      }
    }
    // Two legs from the same market are contradictory by construction (1X2 HOME + DRAW).
    const marketIds = legs.map((l) => l.marketId);
    const duplicates = marketIds.filter((id, index) => marketIds.indexOf(id) !== index);
    if (duplicates.length > 0) throw new ApiError('DUPLICATE_SELECTION', 'Two selections from the same market cannot be combined');

    const count = legs.length;
    if (slip.type === 'SINGLE' && count !== 1) throw new ApiError('TOO_MANY_LEGS', 'A single bet takes exactly one selection');
    if (slip.type === 'MULTIPLE' && count < 2) throw new ApiError('TOO_FEW_LEGS', 'An accumulator needs at least two selections');
    if (count > 20) throw new ApiError('TOO_MANY_LEGS', 'A bet slip holds at most 20 selections');
  }

  private warningsFor(legs: LoadedLeg[], slip: BetSlipInput): string[] {
    const warnings: string[] = [];
    if (legs.some((l) => l.isLive)) warnings.push('This slip contains in-play selections');
    if (legs.length > 1) warnings.push('All selections must win for the accumulator to pay out');
    if (legs.some((l) => l.clientOddsScaled !== l.oddsScaled)) warnings.push('One or more prices changed');
    return warnings;
  }

  private async maxPayoutMinor(currency: Currency): Promise<bigint> {
    try {
      const row = await this.services.db.queryOne<{ value: unknown }>(
        `select value from nova.system_settings where key = 'betting.max_payout_minor' limit 1`,
      );
      if (row && row.value !== null && row.value !== undefined) {
        const parsed = BigInt(String(row.value).replace(/"/g, ''));
        if (parsed > 0n) return parsed;
      }
    } catch (error) {
      log.warn('max payout setting unavailable; using default', { error: (error as Error).message });
    }
    void currency;
    return DEFAULT_MAX_PAYOUT_MINOR;
  }
}
