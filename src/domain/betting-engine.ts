/**
 * NOVA - BETTING ENGINE (orchestration)
 *
 * Canonical placement flow (spec §13). Steps 1-8 are read-only and fail fast with a precise
 * user-facing error; steps 9-15 execute inside ONE database transaction in the SQL function
 * `nova.place_bet` (Supabase/PostgREST cannot hold a client-side transaction, so the whole
 * money path is a single PL/pgSQL function that locks, re-validates, debits, writes the bet,
 * the ledger entry and the audit record, and rolls back on any failure).
 *
 *   1  AUTH                 -> RequestContext.actor
 *   2  USER VALIDATION      -> users.getById
 *   3  ACCOUNT RESTRICTIONS -> users.checkCanTransact (+ self-exclusion / cooling-off)
 *   4  STAKE VALIDATION     -> betslip.validateStake
 *   5  RISK VALIDATION      -> risk-engine.evaluateRisk (single source of limits)
 *   6  LOCK/READ AUTHORITATIVE SELECTIONS -> sports.getSelectionsForBetting
 *   7  READ AUTHORITATIVE ODDS + COMPARE  -> betslip.revalidateSelection
 *   8  VALIDATE MARKET/MATCH -> market-rules.checkMarketGate
 *   9  CALCULATE PAYOUT     -> betslip.potentialPayout (single rounding)
 *  10  DEBIT WALLET         -> nova.place_bet (wallet lock + ledger)
 *  11  CREATE BET + LEGS
 *  12  LEDGER ENTRY
 *  13  AUDIT EVENT
 *  14  COMMIT
 *  15  NOTIFY (outside the transaction - a notification failure NEVER rolls back money)
 */
import { money, type Money } from './money';
import { DomainError } from './errors';
import { checkMarketGate, marketRuleFor } from './market-rules';
import { evaluateRisk, type RiskRuleConfig } from './risk-engine';
import {
  combinedRetention, findConflicts, findCorrelatedLegs, potentialPayout as computePotentialPayout,
  revalidateSelection, validateStake, isBlocking,
} from './betslip';
import type { DomainAdapters } from './ports';
import type {
  Bet, BetQuote, BetQuoteLeg, OddsAdjustment, OddsChangeReport, PlaceBetRequest, PlaceBetResult,
  RequestContext, BetSlipSelectionRequest,
} from './types';
import { oddsMovementBps, type OddsScaled } from './odds';

export interface BettingEngineDeps {
  adapters: DomainAdapters;
  riskConfig: RiskRuleConfig;
  limits: {
    minStakeMinor: bigint;
    maxStakeMinor: bigint;
    maxPayoutMinor: bigint;
    currency: string;
  };
}

export class BettingEngine {
  constructor(private readonly deps: BettingEngineDeps) {}

  private get a(): DomainAdapters {
    return this.deps.adapters;
  }

  /* ------------------------------------------------------------------ *
   * Quote (used by the BetSlip rail/sheet - server-authoritative)      *
   * ------------------------------------------------------------------ */

  async quote(input: {
    actor: RequestContext['actor'];
    selections: BetSlipSelectionRequest[];
    stake: Money;
    mode: 'SINGLE' | 'MULTIPLE';
    ctx: RequestContext;
  }): Promise<BetQuote> {
    const { selections } = input;
    if (selections.length === 0) throw new DomainError('BETSLIP_EMPTY');
    if (selections.length > 1 && input.mode === 'SINGLE') {
      // Singles quote: price each leg independently at the same stake.
      const legs: BetQuoteLeg[] = [];
      const changes: OddsChangeReport[] = [];
      let payout: Money = money(0n, input.stake.currency);
      const rows = await this.a.sports.getSelectionsForBetting(selections.map((s) => s.selectionId));
      for (const req of selections) {
        const row = rows.find((r) => r.selection.id === req.selectionId);
        if (!row) throw new DomainError('NOT_FOUND', 'Selection not found');
        changes.push(...revalidateSelection({
          item: req, authoritative: row, now: this.a.clock.now(),
          liveFreshnessSeconds: 45, prematchFreshnessSeconds: 45,
        }));
        const legPayout = computePotentialPayout(input.stake, [row.selection.odds]);
        payout = money(payout.amount + legPayout.amount, payout.currency);
        legs.push({
          selectionId: req.selectionId, oddsCurrent: row.selection.odds, oddsSeen: req.oddsSeen,
          combinedOddsScaled: row.selection.odds, potentialPayout: legPayout,
        });
      }
      return {
        ok: !changes.some(isBlocking), mode: 'SINGLE', currency: input.stake.currency, stake: input.stake,
        combinedOddsScaled: 0n, potentialPayout: payout, legs, changes,
        requiresAcceptance: changes.some((c) => c.kind === 'ODDS_CHANGED'),
        blocked: changes.some(isBlocking), blockReasons: changes.filter(isBlocking).map((c) => c.kind),
        validUntil: new Date(this.a.clock.now().getTime() + 15_000).toISOString(),
      };
    }

    const rows = await this.a.sports.getSelectionsForBetting(selections.map((s) => s.selectionId));
    const changes: OddsChangeReport[] = [];
    const now = this.a.clock.now();
    const legs: BetQuoteLeg[] = [];
    const authoritativeOdds: OddsScaled[] = [];
    for (const req of selections) {
      const row = rows.find((r) => r.selection.id === req.selectionId);
      if (!row) {
        changes.push({
          kind: 'SELECTION_REMOVED', selectionId: req.selectionId, matchId: req.matchId, marketId: req.marketId,
          label: req.selectionId, previousOdds: req.oddsSeen, currentOdds: null, direction: null,
          message: 'This selection is no longer available',
        });
        continue;
      }
      changes.push(...revalidateSelection({
        item: req, authoritative: row, now,
        liveFreshnessSeconds: 45, prematchFreshnessSeconds: 45,
      }));
      authoritativeOdds.push(row.selection.odds);
      legs.push({
        selectionId: req.selectionId, oddsCurrent: row.selection.odds, oddsSeen: req.oddsSeen,
        combinedOddsScaled: 0n, potentialPayout: money(0n, input.stake.currency),
      });
    }
    const combined = authoritativeOdds.length ? combinedRetention(authoritativeOdds.map((o) => ({ oddsSeen: o }))) : { num: 0n, den: 1n };
    const combinedScaled = authoritativeOdds.length ? (combined.num + combined.den / 2n) / combined.den : 0n;
    const payout = authoritativeOdds.length ? computePotentialPayout(input.stake, authoritativeOdds) : money(0n, input.stake.currency);
    for (const leg of legs) {
      leg.combinedOddsScaled = combinedScaled;
      leg.potentialPayout = payout;
    }
    return {
      ok: !changes.some(isBlocking), mode: input.mode, currency: input.stake.currency, stake: input.stake,
      combinedOddsScaled: combinedScaled, potentialPayout: payout, legs, changes,
      requiresAcceptance: changes.some((c) => c.kind === 'ODDS_CHANGED'),
      blocked: changes.some(isBlocking), blockReasons: changes.filter(isBlocking).map((c) => c.kind),
      validUntil: new Date(now.getTime() + 15_000).toISOString(),
    };
  }

  /* ------------------------------------------------------------------ *
   * Placement                                                          *
   * ------------------------------------------------------------------ */

  async placeBet(request: PlaceBetRequest, ctx: RequestContext): Promise<PlaceBetResult> {
    const log = this.a.logger.child({ op: 'placeBet', correlationId: ctx.correlationId });
    const actor = ctx.actor;
    if (!actor) throw new DomainError('UNAUTHENTICATED');
    if (!request.idempotencyKey || request.idempotencyKey.length < 8) {
      throw new DomainError('VALIDATION_ERROR', 'A valid idempotency key is required');
    }

    // ---- idempotent replay: never create a second bet for the same key
    const existing = await this.a.betting.findByIdempotencyKey(actor.userId, request.idempotencyKey);
    if (existing) {
      const wallet = await this.a.wallet.getWallet(actor.userId, request.stake.currency);
      log.info('bet placement idempotent replay', { betId: existing.id, userId: actor.userId });
      return {
        ok: true, bet: existing, oddsAdjustments: [], walletBalance: wallet?.balance ?? money(0n, request.stake.currency),
        idempotentReplay: true,
      };
    }

    // ---- 1/2 user validation
    const user = await this.a.users.getById(actor.userId);
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Account not found');

    // ---- global kill switches (server-side; the client is never the authority)
    if (await this.a.system.isMaintenanceMode()) throw new DomainError('MAINTENANCE_MODE');
    if (!(await this.a.system.getOperationState('BETTING'))) throw new DomainError('BETTING_DISABLED');

    // ---- 3 account restrictions
    const gate = await this.a.users.checkCanTransact(actor.userId, 'bet');
    if (!gate.allowed) throw new DomainError((gate.code as never) ?? 'ACCOUNT_RESTRICTED', gate.reason ?? 'Account cannot place bets');

    // ---- 6 authoritative selections BEFORE stake/risk so limits use real odds
    const selectionIds = request.selections.map((s) => s.selectionId);
    const rows = await this.a.sports.getSelectionsForBetting(selectionIds);
    if (rows.length !== selectionIds.length) {
      throw new DomainError('NOT_FOUND', 'One or more selections no longer exist');
    }
    const now = this.a.clock.now();
    const isLive = rows.some((r) => r.market.isLive);
    const opState = isLive ? await this.a.system.getOperationState('LIVE_BETTING') : await this.a.system.getOperationState('PREMATCH_BETTING');
    if (!opState) throw new DomainError(isLive ? 'LIVE_BETTING_DISABLED' : 'PREMATCH_BETTING_DISABLED');

    // ---- 7 odds comparison (never trust client odds, never silently replace them)
    const changes: OddsChangeReport[] = [];
    for (const req of request.selections) {
      const row = rows.find((r) => r.selection.id === req.selectionId);
      if (!row) continue;
      changes.push(...revalidateSelection({
        item: req, authoritative: row, now,
        liveFreshnessSeconds: 45, prematchFreshnessSeconds: 45,
      }));
    }
    const blocking = changes.filter(isBlocking);
    if (blocking.length > 0) {
      const first = blocking[0]!;
      const mapping: Record<string, string> = {
        SELECTION_SUSPENDED: 'SELECTION_SUSPENDED', MARKET_SUSPENDED: 'MARKET_SUSPENDED', MARKET_CLOSED: 'MARKET_CLOSED',
        MATCH_FINISHED: 'MATCH_FINISHED', MATCH_POSTPONED: 'MATCH_POSTPONED', STALE_ODDS: 'STALE_ODDS',
        SELECTION_REMOVED: 'NOT_FOUND', ODDS_MISSING: 'ODDS_MISSING',
      };
      throw new DomainError((mapping[first.kind] ?? 'SELECTION_SUSPENDED') as never, first.message, { changes });
    }
    const oddsChanges = changes.filter((c) => c.kind === 'ODDS_CHANGED');
    if (oddsChanges.length > 0 && !request.acceptOddsChange) {
      log.info('odds changed, user acceptance required', { userId: actor.userId, count: oddsChanges.length });
      throw new DomainError('ODDS_CHANGED', 'Odds have changed. Review and accept the new odds.', { changes });
    }

    // ---- 8 market / match gates
    for (const row of rows) {
      const rule = marketRuleFor(row.market.key) ?? marketRuleFor(row.market.type);
      if (!rule) throw new DomainError('MARKET_SUSPENDED', `Unsupported market: ${row.market.key}`);
      const live = await this.a.system.getFeatureFlags();
      const gateMarket = checkMarketGate({
        rule, matchStatus: row.match.status, now, scheduledAt: new Date(row.match.scheduledAt),
        isLive: row.market.isLive,
        liveBettingEnabled: live.liveBetting === true && (await this.a.system.getOperationState('LIVE_BETTING')),
        prematchBettingEnabled: live.preMatchBetting !== false && (await this.a.system.getOperationState('PREMATCH_BETTING')),
      });
      if (!gateMarket.allowed) throw new DomainError(gateMarket.code as never, gateMarket.reason);
      if (row.market.status === 'closed' || row.market.status === 'settled' || row.market.status === 'void') {
        throw new DomainError('MARKET_CLOSED', 'This market is closed');
      }
      if (row.market.status === 'suspended') throw new DomainError('MARKET_SUSPENDED', 'This market is suspended');
      if (row.selection.status !== 'open') throw new DomainError('SELECTION_SUSPENDED', 'This selection is suspended');
    }

    // ---- multiple-leg structural validation
    if (rows.length > 1) {
      const conflicts = findConflicts(request.selections as never);
      if (conflicts.length > 0) throw new DomainError('BETSLIP_CONFLICTING_SELECTION', conflicts[0]!.reason);
      const marketTypes: Record<string, string> = {};
      for (const row of rows) marketTypes[row.market.id] = row.market.type;
      const correlated = findCorrelatedLegs(request.selections as never, marketTypes);
      if (correlated.length > 0) throw new DomainError('BETSLIP_CONFLICTING_SELECTION', correlated[0]!.reason);
    }

    // ---- 9 payout calculation (authoritative odds only)
    const authoritativeOdds = rows.map((r) => r.selection.odds);
    const payout = computePotentialPayout(request.stake, authoritativeOdds);

    // ---- 4 stake validation
    const wallet = await this.a.wallet.getWallet(actor.userId, request.stake.currency);
    if (!wallet) throw new DomainError('NOT_FOUND', 'Wallet not found');
    const stakeCheck = validateStake({
      stake: request.stake, wallet: wallet.balance,
      minStake: money(this.deps.limits.minStakeMinor, request.stake.currency),
      maxStake: money(this.deps.limits.maxStakeMinor, request.stake.currency),
      maxPayout: money(this.deps.limits.maxPayoutMinor, request.stake.currency),
      potentialPayout: payout, hasBetSlipItems: rows.length > 0,
    });
    if (!stakeCheck.ok) throw new DomainError(stakeCheck.code as never, stakeCheck.message ?? undefined, { suggestedStake: stakeCheck.suggestedStake ? stakeCheck.suggestedStake.amount.toString() : null });

    // ---- 5 risk
    const matchIds = Array.from(new Set(rows.map((r) => r.match.id)));
    const marketIds = Array.from(new Set(rows.map((r) => r.market.id)));
    const exposure = await this.a.betting.exposureForSelections(selectionIds);
    const [dailyStake, dailyPayout] = await Promise.all([
      this.a.betting.dailyStakeMinor(actor.userId, request.stake.currency, new Date(now.getTime() - 86_400_000)),
      this.a.betting.dailyPayoutMinor(actor.userId, request.stake.currency, new Date(now.getTime() - 86_400_000)),
    ]);
    const restrictions = await this.a.users.listRestrictions(actor.userId);
    const risk = evaluateRisk({
      currency: request.stake.currency,
      userId: actor.userId,
      isLive,
      sportId: rows[0]!.match.sportId,
      leagueId: rows[0]!.match.leagueId,
      matchId: matchIds[0] ?? null,
      marketIds,
      stake: request.stake,
      potentialPayout: payout,
      odds: authoritativeOdds,
      accountStatus: user.status,
      selfExcluded: restrictions.some((r) => r.kind === 'self_exclusion'),
      coolingOffUntil: restrictions.find((r) => r.kind === 'cooling_off' && r.until)?.until
        ? new Date(restrictions.find((r) => r.kind === 'cooling_off')!.until as string) : null,
      kycStatus: user.kycStatus,
      ageVerified: user.ageVerified,
      jurisdiction: user.jurisdiction,
      blockedJurisdictions: [],
      dailyStakeMinor: dailyStake,
      dailyPayoutMinor: dailyPayout,
      selectionExposureMinor: exposure.reduce((acc, e) => (acc > e.stakeMinor ? acc : e.stakeMinor), 0n),
      matchExposureMinor: exposure.reduce((acc, e) => acc + e.payoutMinor, 0n),
      marketExposureMinor: exposure.reduce((acc, e) => acc + e.payoutMinor, 0n),
      userExposureMinor: exposure.reduce((acc, e) => acc + e.payoutMinor, 0n),
      userDailyStakeLimitMinor: null,
      userLossLimitMinor: null,
      now,
    }, this.deps.riskConfig);

    if (risk.decision === 'REJECT') {
      const reason = risk.reasons[0] ?? 'RISK_REJECTED';
      const directDomainCodes = new Set([
        'AGE_NOT_VERIFIED',
        'ACCOUNT_SELF_EXCLUDED',
        'ACCOUNT_COOLING_OFF',
        'ACCOUNT_SUSPENDED',
        'ACCOUNT_RESTRICTED',
        'KYC_INVALID',
        'JURISDICTION_BLOCKED',
      ]);
      if (directDomainCodes.has(reason)) {
        throw new DomainError(reason as any, reason, { reasons: risk.reasons });
      }
      throw new DomainError('RISK_REJECTED', 'This bet cannot be accepted', { reasons: risk.reasons });
    }
    if (risk.decision === 'MANUAL_REVIEW') throw new DomainError('RISK_MANUAL_REVIEW', 'This bet was sent for manual review', { reasons: risk.reasons });
    if (risk.decision === 'LIMIT' && risk.maxStakeAllowed) {
      throw new DomainError('STAKE_ABOVE_MAXIMUM', 'Stake reduced by risk limits', { maxStakeAllowed: risk.maxStakeAllowed.amount.toString(), reasons: risk.reasons });
    }

    // ---- 10-14 single atomic transaction (lock -> revalidate -> debit -> bet -> ledger -> audit)
    log.info('placing bet', {
      userId: actor.userId, stake: request.stake.amount.toString(), legs: rows.length,
      payout: payout.amount.toString(), correlationId: ctx.correlationId,
    });
    const result = await this.a.betting.placeBetAtomic({
      userId: actor.userId,
      request,
      riskApprovedStakeMinor: risk.maxStakeAllowed?.amount ?? request.stake.amount,
      correlationId: ctx.correlationId,
      context: { ip: ctx.ip, userAgent: ctx.userAgent, device: request.device ?? null },
    });

    const adjustments: OddsAdjustment[] = result.bet.legs
      .map((leg): OddsAdjustment => {
        const seen = request.selections.find((s) => s.selectionId === leg.selectionId)?.oddsSeen ?? leg.oddsAtPlacement;
        return {
          selectionId: leg.selectionId,
          previousOdds: seen,
          currentOdds: leg.acceptedOdds,
          direction: leg.acceptedOdds >= seen ? 'INCREASED' : 'DECREASED',
        };
      })
      .filter((adj) => adj.previousOdds !== adj.currentOdds);

    // ---- 15 notifications: outside the transaction by design.
    try {
      await this.a.notifications.create({
        userId: actor.userId,
        type: 'bet_accepted',
        title: 'Bet accepted',
        body: `Bet ${result.bet.publicId} accepted with ${result.bet.legs.length} selection(s)`,
        linkPath: `/bets/${result.bet.publicId}`,
        data: { betId: result.bet.id, publicId: result.bet.publicId },
      });
    } catch (error) {
      log.warn('bet accepted notification failed (money already committed)', { error: String(error) });
    }

    return {
      ok: true,
      bet: result.bet,
      oddsAdjustments: adjustments.length ? adjustments : oddsChanges.map((c) => ({
        selectionId: c.selectionId,
        previousOdds: c.previousOdds ?? 0n,
        currentOdds: (c.currentOdds ?? 0n) as OddsScaled,
        direction: (c.direction === 'INCREASED' ? 'INCREASED' : 'DECREASED') as 'INCREASED' | 'DECREASED',
      })),
      walletBalance: result.walletBalance,
      idempotentReplay: result.idempotentReplay,
    };
  }

  /** Movement summary used by the odds-change UI (OLD -> NEW with direction + bps). */
  describeOddsMovement(previous: OddsScaled, current: OddsScaled): { direction: 'UP' | 'DOWN' | 'SAME'; bps: bigint } {
    const bps = oddsMovementBps(previous, current);
    return { direction: bps > 0n ? 'UP' : bps < 0n ? 'DOWN' : 'SAME', bps };
  }

  /** Bet history for the account area - paginated, never unbounded. */
  async history(userId: string, opts: { limit: number; cursor?: string | null; status?: string | null }): Promise<{ items: Bet[]; nextCursor: string | null }> {
    return this.a.betting.listBets(userId, opts);
  }
}
