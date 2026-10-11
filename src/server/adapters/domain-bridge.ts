/**
 * DOMAIN BRIDGE (adapters at the hexagonal edge).
 *
 * The pure `src/domain` engines decide *what should happen* (grading, pricing, commission
 * math, risk). This bridge is how those decisions reach the database, and it deliberately
 * funnels EVERY money movement into the authoritative SQL functions:
 *
 *   domain decision  ->  nova.settle_bet / nova.post_wallet_entry / nova.settle_affiliate_period
 *
 * There is exactly ONE implementation of each money path (SQL) and exactly ONE
 * implementation of each decision (domain TS); the bridge only translates.
 */
import { money, type Money } from '@/domain/money';
import type { DomainAdapters, Logger as DomainLogger } from '@/domain/ports';
import type {
  Affiliate as DomainAffiliate, Bet as DomainBet, Match as DomainMatch, Market as DomainMarket,
  MatchResult as DomainMatchResult, OddsRecord, Selection as DomainSelection, SettlementJob,
  WalletTransaction as DomainWalletTransaction, UserProfile as DomainUserProfile,
} from '@/domain/types';
import type { Db } from '@/lib/ports/db';
import { ApiError } from '@/lib/errors';
import { createLogger } from '@/server/logger';
import { cryptoIds } from '@/server/utils/ids';
import { FixedClock, SystemClock } from '@/domain/time';
import { toBig, toBigOrNull, toBool, toIso, toIsoOrNull, toJson, toNum, toNumOrNull, toStr, toStrOrNull, pgArray, type Row } from '@/server/db/rows';

const SYSTEM_CLOCK = new SystemClock();

export interface BridgeOptions {
  workerId?: string;
  /** Frozen clock for deterministic tests. */
  now?: Date;
}

export function createDomainAdapters(db: Db, options: BridgeOptions = {}): DomainAdapters {
  const clock = options.now ? new FixedClock(options.now) : SYSTEM_CLOCK;
  const logger: DomainLogger = createLogger({ component: 'domain', workerId: options.workerId ?? null });

  const domainMoney = (amountMinor: unknown, currency: string): Money => money(toBig(amountMinor), currency);

  const adapters: DomainAdapters = {
    clock,
    ids: cryptoIds,

    /* ---------------------------------------------------------------- system */
    system: {
      async isMaintenanceMode() {
        const row = await db.queryOne<Row>(`select nova.maintenance_mode() as on`);
        return Boolean(row?.on);
      },
      async getOperationState(op: string) {
        const row = await db.queryOne<Row>(`select nova.operation_enabled($1) as on`, [op]);
        return Boolean(row?.on);
      },
      async setOperationState(op: string, enabled: boolean, actorId: string | null, reason: string) {
        await db.rpc('set_operation', { p_key: op, p_enabled: enabled, p_actor: actorId, p_reason: reason });
      },
      async getFeatureFlags() {
        const rows = await db.query<Row>(`select key, enabled from nova.feature_flags`);
        return Object.fromEntries(rows.map((r) => [toStr(r.key), toBool(r.enabled)]));
      },
    },

    /* ----------------------------------------------------------------- users */
    users: {
      async getById(userId: string) {
        const row = await db.queryOne<Row>(`select * from nova.profiles where id = $1`, [userId]);
        return row ? mapUser(row) : null;
      },
      async getByEmail(email: string) {
        const row = await db.queryOne<Row>(`select * from nova.profiles where lower(email) = lower($1)`, [email]);
        return row ? mapUser(row) : null;
      },
      async getByPublicId(publicId: string) {
        const row = await db.queryOne<Row>(`select * from nova.profiles where public_id = $1`, [publicId]);
        return row ? mapUser(row) : null;
      },
      async checkCanTransact(userId: string, kind) {
        const row = await db.queryOne<Row>(
          `select p.status::text as status, p.age_verified, p.kyc_status::text as kyc_status,
                  l.self_excluded_until
             from nova.profiles p left join nova.user_limits l on l.user_id = p.id and l.currency = p.preferred_currency
            where p.id = $1`, [userId],
        );
        if (!row) return { allowed: false, reason: 'Account not found', code: 'NOT_FOUND' };
        const status = toStr(row.status);
        if (status === 'suspended' || status === 'banned') return { allowed: false, reason: 'Account suspended', code: 'ACCOUNT_SUSPENDED' };
        if (status === 'self_excluded' || (row.self_excluded_until && new Date(toIso(row.self_excluded_until)) > clock.now())) {
          return { allowed: false, reason: 'Self-exclusion is active', code: 'ACCOUNT_SELF_EXCLUDED' };
        }
        if (status === 'closed') return { allowed: false, reason: 'Account closed', code: 'ACCOUNT_CLOSED' };
        if (!toBool(row.age_verified)) return { allowed: false, reason: 'Age not verified', code: 'AGE_RESTRICTED' };
        if (kind === 'withdraw' && toStr(row.kyc_status) !== 'verified') {
          return { allowed: false, reason: 'Identity verification required', code: 'KYC_REQUIRED' };
        }
        return { allowed: true, reason: null, code: null };
      },
      async listRestrictions(userId: string) {
        const rows = await db.query<Row>(
          `select kind, reason, effective_to from nova.user_restrictions
            where user_id = $1 and is_active and (effective_to is null or effective_to > now())`, [userId],
        );
        return rows.map((r) => ({ kind: toStr(r.kind), reason: toStr(r.reason, 'restriction'), until: toIsoOrNull(r.effective_to) }));
      },
    },

    /* ---------------------------------------------------------------- sports */
    sports: {
      async getMatch(matchId: string) {
        const row = await db.queryOne<Row>(`select * from nova.matches where id = $1`, [matchId]);
        return row ? mapMatch(row) : null;
      },
      async getMatchesByIds(matchIds: string[]) {
        if (matchIds.length === 0) return [];
        const rows = await db.query<Row>(`select * from nova.matches where id = any($1::uuid[])`, [pgArray(matchIds)]);
        return rows.map(mapMatch);
      },
      async getMarket(marketId: string) {
        const rows = await db.query<Row>(`select * from nova.markets where id = $1`, [marketId]);
        const row = rows[0];
        if (!row) return null;
        const selections = await db.query<Row>(`select * from nova.selections where market_id = $1 order by participant_type, code`, [marketId]);
        return mapMarket(row, selections);
      },
      async getSelection(selectionId: string) {
        const row = await db.queryOne<Row>(`select * from nova.selections where id = $1`, [selectionId]);
        return row ? mapSelection(row) : null;
      },
      async getSelectionsForBetting(selectionIds: string[]) {
        if (selectionIds.length === 0) return [];
        const rows = await db.query<Row>(
          `select s.*, mk.id as mk_id, mk.key as mk_key, mk.type as mk_type, mk.name as mk_name, mk.name_fa as mk_name_fa,
                  mk.status::text as mk_status, mk.specifier as mk_specifier, mk.period as mk_period,
                  mk.display_order as mk_display_order, mk.is_live as mk_is_live, mk.updated_at as mk_updated_at,
                  m.id as m_id, m.league_id, m.sport_id, m.season_id, m.home_team_id, m.away_team_id, m.status::text as m_status,
                  m.clock, m.minute, m.period as m_period, m.home_score, m.away_score, m.scheduled_at, m.started_at,
                  m.finished_at, m.venue, m.has_live_stream
             from nova.selections s
             join nova.markets mk on mk.id = s.market_id
             join nova.matches m on m.id = s.match_id
            where s.id = any($1::uuid[])
            order by mk.display_order, s.code`,
          [pgArray(selectionIds)],
        );
        return rows.map((r) => ({
          selection: mapSelection(r),
          market: mapMarket({ id: r.mk_id, match_id: r.match_id, key: r.mk_key, type: r.mk_type, name: r.mk_name, name_fa: r.mk_name_fa, status: r.mk_status, specifier: r.mk_specifier, period: r.mk_period, display_order: r.mk_display_order, is_live: r.mk_is_live, updated_at: r.mk_updated_at }, []),
          match: mapMatch({
            id: r.m_id, league_id: r.league_id, sport_id: r.sport_id, season_id: r.season_id, home_team_id: r.home_team_id,
            away_team_id: r.away_team_id, status: r.m_status, clock: r.clock, minute: r.minute, period: r.m_period,
            home_score: r.home_score, away_score: r.away_score, scheduled_at: r.scheduled_at, started_at: r.started_at,
            finished_at: r.finished_at, venue: r.venue, has_live_stream: r.has_live_stream,
          }),
        }));
      },
      async getOddsFreshnessSeconds() {
        const rows = await db.query<Row>(`select value from nova.system_settings where key = 'odds_freshness'`);
        const value = toJson<{ prematch_seconds?: number; live_seconds?: number }>(rows[0]?.value, {});
        return { prematch: value.prematch_seconds ?? 45, live: value.live_seconds ?? 12 };
      },
    },

    /* ---------------------------------------------------------------- wallet */
    wallet: {
      async postEntry(entry) {
        const result = await db.rpc<Row>('post_wallet_entry', {
          p_user_id: entry.userId, p_type: entry.type, p_amount_minor: entry.amount.amount.toString(),
          p_currency: entry.amount.currency, p_idempotency_key: entry.idempotencyKey,
          p_reference: entry.reference ?? null, p_bet_id: entry.betId ?? null,
          p_payment_transaction_id: entry.paymentTransactionId ?? null, p_reversal_of: entry.reversalOf ?? null,
          p_reason: entry.reason ?? null, p_actor_id: entry.actorId ?? null,
          p_metadata: entry.metadata ?? {}, p_balance_floor: entry.balanceFloor?.toString() ?? null,
        });
        return {
          transaction: mapWalletTransaction({ ...result, user_id: entry.userId, type: entry.type }, entry),
          balanceAfter: money(toBig(result.balance_after_minor), entry.amount.currency),
          idempotentReplay: Boolean(result.idempotent_replay),
        };
      },
      async getWallet(userId: string, currency: string) {
        const row = await db.queryOne<Row>(`select * from nova.wallets where user_id = $1 and currency = $2`, [userId, currency]);
        if (!row) return null;
        const balance = toBig(row.balance_minor);
        const locked = toBig(row.locked_minor);
        return {
          id: toStr(row.id), userId: toStr(row.user_id), currency: toStr(row.currency), balance: money(balance, currency),
          locked: money(locked, currency), available: money(balance - locked, currency),
          version: toNum(row.version, 1), updatedAt: toIso(row.updated_at),
        };
      },
      async listTransactions(userId, opts) {
        const rows = await db.query<Row>(
          `select * from nova.wallet_transactions where user_id = $1
             and ($2::text[] is null or type::text = any($2))
             and ($3::timestamptz is null or created_at < $3)
           order by created_at desc limit $4`,
          [userId, opts.types?.length ? pgArray(opts.types) : null, opts.cursor ?? null, opts.limit],
        );
        const items = rows.map((r) => mapWalletTransaction(r));
        return { items, nextCursor: items.length === opts.limit ? items[items.length - 1]!.createdAt : null };
      },
      async ledgerSumMinor(userId: string, currency: string) {
        const row = await db.queryOne<Row>(
          `select coalesce(sum(amount_minor),0) as total from nova.wallet_transactions where user_id = $1 and currency = $2 and status = 'posted'`,
          [userId, currency],
        );
        return toBig(row?.total);
      },
    },

    /* --------------------------------------------------------------- betting */
    betting: {
      async placeBetAtomic({ userId, request, correlationId, context }) {
        const result = await db.rpc<Row>('place_bet', {
          p_user_id: userId, p_idempotency_key: request.idempotencyKey, p_mode: request.mode,
          p_stake_minor: request.stake.amount.toString(), p_currency: request.stake.currency,
          p_selections: request.selections.map((s) => ({
            match_id: s.matchId, market_id: s.marketId, selection_id: s.selectionId,
            odds_seen: s.oddsSeen?.toString() ?? null, odds_version: s.oddsVersionSeen ?? null,
          })),
          p_accept_odds_change: request.acceptOddsChange,
          p_device: context.device ?? null, p_campaign: request.campaign ?? null,
          p_correlation_id: correlationId, p_ip_hash: context.ip ?? null, p_user_agent: context.userAgent ?? null,
        });
        const changes = Array.isArray(result.odds_changes) ? (result.odds_changes as Row[]) : [];
        return {
          ok: true,
          bet: mapDomainBet(result.bet as Row),
          oddsAdjustments: changes.map((c) => ({
            selectionId: toStr(c.selection_id),
            previousOdds: toBig(c.previous_odds, 10_100n),
            currentOdds: toBig(c.current_odds, 10_100n),
            direction: toBig(c.current_odds, 10_100n) >= toBig(c.previous_odds, 10_100n) ? 'INCREASED' : 'DECREASED',
          })),
          walletBalance: money(toBig(result.wallet_balance_minor), request.stake.currency),
          idempotentReplay: Boolean(result.idempotent_replay),
        };
      },
      async findByIdempotencyKey(userId: string, key: string) {
        const row = await db.queryOne<Row>(`select id from nova.bets where user_id = $1 and placement_idempotency_key = $2`, [userId, key]);
        return row ? this.getBet(toStr(row.id)) : null;
      },
      async getBet(betId: string) {
        const result = await db.rpc<Row>('bet_payload', { p_bet_id: betId });
        return result?.bet ? mapDomainBet(result.bet as Row) : null;
      },
      async getBetByPublicId(publicId: string) {
        const row = await db.queryOne<Row>(`select id from nova.bets where public_id = $1`, [publicId]);
        return row ? this.getBet(toStr(row.id)) : null;
      },
      async listBets(userId, opts) {
        const rows = await db.query<Row>(
          `select id, placed_at from nova.bets where user_id = $1
             and ($2::text is null or status::text = $2) and ($3::timestamptz is null or placed_at < $3)
           order by placed_at desc limit $4`,
          [userId, opts.status ?? null, opts.cursor ?? null, opts.limit],
        );
        const items: DomainBet[] = [];
        for (const row of rows) {
          const bet = await this.getBet(toStr(row.id));
          if (bet) items.push(bet);
        }
        return { items, nextCursor: rows.length === opts.limit ? toIso(rows[rows.length - 1]!.placed_at) : null };
      },
      async exposureForSelections(selectionIds: string[]) {
        if (selectionIds.length === 0) return [];
        const rows = await db.query<Row>(
          `select l.selection_id, coalesce(sum(b.stake_minor),0) as stake_minor,
                  coalesce(sum(b.potential_payout_minor),0) as payout_minor, count(*) as bet_count
             from nova.bet_legs l join nova.bets b on b.id = l.bet_id
            where l.selection_id = any($1::uuid[]) and b.status in ('accepted','partially_settled')
            group by l.selection_id`,
          [pgArray(selectionIds)],
        );
        return rows.map((r) => ({
          selectionId: toStr(r.selection_id), stakeMinor: toBig(r.stake_minor),
          payoutMinor: toBig(r.payout_minor), betCount: toNum(r.bet_count),
        }));
      },
      async dailyStakeMinor(userId: string, currency: string, since: Date) {
        const row = await db.queryOne<Row>(
          `select coalesce(sum(stake_minor),0) as total from nova.bets
            where user_id = $1 and currency = $2 and placed_at >= $3 and status not in ('rejected','cancelled')`,
          [userId, currency, since.toISOString()],
        );
        return toBig(row?.total);
      },
      async dailyPayoutMinor(userId: string, currency: string, since: Date) {
        const row = await db.queryOne<Row>(
          `select coalesce(sum(payout_minor),0) as total from nova.bets
            where user_id = $1 and currency = $2 and settled_at >= $3 and status in ('settled','partially_settled')`,
          [userId, currency, since.toISOString()],
        );
        return toBig(row?.total);
      },
    },

    /* ------------------------------------------------------------ settlement */
    settlement: {
      async getMatchResult(matchId: string) {
        const row = await db.queryOne<Row>(
          `select r.*, m.provider as owner_provider, m.provider_id as owner_provider_id
             from nova.match_results r
             join nova.matches m on m.id = r.match_id
            where r.match_id = $1
            order by r.revision desc
            limit 1`,
          [matchId],
        );
        if (!row) return null;

        const resultProvider = toStrOrNull(row.provider);
        const resultProviderId = toStrOrNull(row.provider_result_id);
        const ownerProvider = toStrOrNull(row.owner_provider);
        const ownerProviderId = toStrOrNull(row.owner_provider_id);
        const authoritative = toBool(row.authoritative, false);

        if (
          authoritative !== true ||
          !resultProvider ||
          !resultProviderId ||
          !ownerProvider ||
          !ownerProviderId ||
          resultProvider !== ownerProvider ||
          resultProviderId !== ownerProviderId
        ) {
          console.error('[settlement] Rejected result: provider ownership or authority mismatch', {
            matchId,
            resultProvider,
            ownerProvider,
            hasResultProviderId: Boolean(resultProviderId),
            hasOwnerProviderId: Boolean(ownerProviderId),
            authoritative,
          });
          return null;
        }

        return mapMatchResult(row);
      },
      async enqueueForMatch(matchId: string, reason: string) {
        const result = await db.rpc<number>('enqueue_match_settlement', { p_match_id: matchId, p_reason: reason });
        return toNum(result);
      },
      async claimJobs(workerId: string, limit: number) {
        const rows = await db.rpcRows<Row>('claim_settlement_jobs', {
          p_worker_id: workerId,
          p_limit: limit,
          p_lock_ttl_seconds: 300,
        });
        return (rows ?? []).map(mapSettlementJob);
      },
      async settleBetAtomic(input) {
        const result = await db.rpc<Row>('settle_bet', {
          p_bet_id: input.betId,
          p_graded_legs: input.gradedLegs.map((l) => ({ selection_id: l.selectionId, grade: l.grade, reason: l.reason })),
          p_payout_minor: input.payoutMinor.toString(),
          p_currency: input.currency,
          p_revision: input.resultRevision,
          p_worker: input.workerId,
          p_correlation_id: input.correlationId,
        });
        const status = toStr(result.status, 'settled');
        return {
          betId: input.betId,
          status: mapBetStatus(status),
          payout: money(toBig(result.payout_minor), input.currency),
          gradedLegs: input.gradedLegs,
          ledgerTransactionId: toStrOrNull(result.transaction_id),
          idempotentReplay: status === 'idempotent_replay' || Boolean(result.idempotent_replay),
          manualReviewReason: status === 'manual_review' ? toStrOrNull(result.reason) : null,
        };
      },
      async completeJob(
        jobId: string,
        workerId: string,
        status: 'done' | 'failed' | 'manual_review',
        error?: string | null,
      ) {
        await db.rpc('complete_settlement_job', {
          p_job_id: jobId,
          p_worker_id: workerId,
          p_status: status,
          p_error: error ?? null,
        });
      },
      async listSettlementQueue(opts) {
        const rows = await db.query<Row>(
          `select * from nova.settlement_jobs where ($1::text is null or status::text = $1) order by created_at desc limit $2 offset $3`,
          [opts.status ?? null, opts.limit, (opts.page - 1) * opts.limit],
        );
        const count = await db.queryOne<Row>(
          `select count(*) as total from nova.settlement_jobs where ($1::text is null or status::text = $1)`, [opts.status ?? null],
        );
        return { items: rows.map(mapSettlementJob), total: toNum(count?.total) };
      },
      async findStuckBets(limit: number) {
        const rows = await db.query<Row>(`select * from nova.find_stuck_bets($1)`, [limit]);
        const bets: DomainBet[] = [];
        for (const row of rows) {
          const betId = toStr(row.bet_id ?? row.id);
          const payload = await db.rpc<Row>('bet_payload', { p_bet_id: betId });
          if (payload?.bet) bets.push(mapDomainBet(payload.bet as Row));
        }
        return bets;
      },
      async reverseBetSettlement(input) {
        const result = await db.rpc<Row>('reverse_bet_settlement', {
          p_bet_id: input.betId, p_reason: input.reason, p_actor_id: input.actorId, p_correlation_id: input.correlationId,
        });
        return { reversed: toBool(result?.ok ?? true), ledgerTransactionId: toStrOrNull(result?.reversal_transaction_id) };
      },
    },

    /* ------------------------------------------------------------- affiliate */
    affiliate: {
      async getByUserId(userId: string) {
        const row = await db.queryOne<Row>(`select * from nova.affiliates where user_id = $1`, [userId]);
        return row ? mapAffiliate(row) : null;
      },
      async getById(affiliateId: string) {
        const row = await db.queryOne<Row>(`select * from nova.affiliates where id = $1`, [affiliateId]);
        return row ? mapAffiliate(row) : null;
      },
      async getByCode(code: string) {
        const row = await db.queryOne<Row>(`select * from nova.affiliates where upper(code) = upper($1)`, [code]);
        return row ? mapAffiliate(row) : null;
      },
      async resolveEffectiveConfig(affiliateId: string, sportId?: string | null, campaign?: string | null) {
        const result = await db.rpc<Row>('resolve_commission_config', {
          p_affiliate_id: affiliateId, p_sport_id: sportId ?? null, p_campaign: campaign ?? null,
        });
        const payload = (result?.config ?? result) as Row;
        return {
          commissionModel: toStr(payload.commission_model, 'NON_NEGATIVE_35'),
          commissionRateBps: toNum(payload.commission_rate_bps, 3500),
          allowNegativeBalance: toBool(payload.allow_negative_balance),
          negativeBalanceFloorMinor: toBig(payload.negative_balance_floor_minor),
          minPayoutMinor: toBig(payload.min_payout_minor, 5_000_000n),
          maxPayoutMinor: toBigOrNull(payload.max_payout_minor),
          parentOverrideBps: toNum(payload.parent_override_bps),
          netCapBps: toBigOrNull(payload.total_net_bps_cap) === null ? null : toNum(payload.total_net_bps_cap),
          source: toStr(payload.source, 'affiliate'),
        };
      },
      async postLedgerEntries(entries) {
        // Affiliate ledger writes flow through the same authoritative functions used by
        // settlement (`nova.apply_bet_commission` / `nova.affiliate_adjustment`); nothing
        // here inserts ledger rows directly, so the ledger stays append-only and derived.
        let inserted = 0;
        let skipped = 0;
        for (const entry of entries) {
          if (!entry.betSettlementId && !entry.settlementId && !entry.payoutId) {
            skipped += 1;
            continue;
          }
          skipped += 1;   // already materialised by the SQL settlement path
        }
        return { inserted, skipped };
      },
      async listLedger(affiliateId, opts) {
        const rows = await db.query<Row>(
          `select * from nova.affiliate_ledger where affiliate_id = $1
             and ($2::text is null or type::text = $2) and ($3::timestamptz is null or created_at < $3)
           order by created_at desc limit $4`,
          [affiliateId, opts.type ?? null, opts.cursor ?? null, opts.limit],
        );
        const items = rows.map(mapAffiliateLedger);
        return { items, nextCursor: items.length === opts.limit ? items[items.length - 1]!.createdAt : null };
      },
      async getStats(affiliateId: string) {
        const row = await db.queryOne<Row>(
          `select count(distinct user_id) as referred,
                  coalesce(sum(turnover_minor),0) as turnover,
                  coalesce(sum(settled_bets),0) as settled,
                  coalesce(sum(user_wins_minor),0) as wins,
                  coalesce(sum(user_losses_minor),0) as losses,
                  coalesce(sum(commission_minor),0) as commission,
                  max(currency) as currency
             from nova.affiliate_daily_stats where affiliate_id = $1`, [affiliateId],
        );
        const active = await db.queryOne<Row>(
          `select count(*) as total from nova.affiliate_attributions where affiliate_id = $1 and status = 'confirmed'`, [affiliateId],
        );
        return {
          affiliateId, totalReferred: toNum(row?.referred), active: toNum(active?.total),
          firstDeposits: 0, totalTurnoverMinor: toBig(row?.turnover), settledBets: toNum(row?.settled),
          userWinsMinor: toBig(row?.wins), userLossesMinor: toBig(row?.losses),
          pendingCommissionMinor: toBig(row?.commission), currency: toStr(row?.currency, 'IRT'),
        };
      },
      async rawBalanceMinor(affiliateId: string) {
        const balance = await this.payableBalanceMinor(affiliateId);
        return { currency: 'IRT', minor: balance.raw };
      },
      async payableBalanceMinor(affiliateId: string) {
        const row = await db.queryOne<Row>(`select * from nova.affiliate_payable_balance($1)`, [affiliateId]);
        return {
          currency: toStr(row?.currency, 'IRT'), payable: toBig(row?.payable_minor), raw: toBig(row?.raw_minor),
          floorApplied: toBool(row?.floor_applied),
        };
      },
      async createSettlement(input) {
        const result = await db.rpc<Row>('settle_affiliate_period', {
          p_affiliate_id: input.affiliateId, p_period_start: input.periodStart.toISOString(),
          p_period_end: input.periodEnd.toISOString(), p_worker: input.workerId,
        });
        return {
          id: toStr(result.settlement_id), affiliateId: input.affiliateId,
          periodStart: input.periodStart.toISOString(), periodEnd: input.periodEnd.toISOString(),
          status: toBool(result.duplicate) ? 'duplicate' : 'settled', currency: 'IRT',
          openingCarryMinor: toBig(result.opening_carry_minor), grossCommissionMinor: toBig(result.gross_minor),
          negativeImpactMinor: toBig(result.debit_minor), netMinor: toBig(result.net_minor),
          closingCarryMinor: toBig(result.closing_carry_minor), payableMinor: toBig(result.payable_minor),
          suppressedMinor: toBig(result.suppressed_minor), floorApplied: toBool(result.floor_applied),
          cappedByCap: toBool(result.capped), entriesCount: toNum(result.entries),
          payoutId: toStrOrNull((result.payout as Row | null)?.id), settledAt: clock.now().toISOString(),
        } as never;
      },
      async listSettlements(affiliateId, opts) {
        const rows = await db.query<Row>(
          `select * from nova.affiliate_settlements where affiliate_id = $1 order by period_end desc limit $2 offset $3`,
          [affiliateId, opts.limit, (opts.page - 1) * opts.limit],
        );
        const count = await db.queryOne<Row>(
          `select count(*) as total from nova.affiliate_settlements where affiliate_id = $1`, [affiliateId],
        );
        return {
          items: rows.map((r) => ({
            id: toStr(r.id), affiliateId: toStr(r.affiliate_id), periodStart: toIso(r.period_start), periodEnd: toIso(r.period_end),
            status: toStr(r.status), currency: toStr(r.currency, 'IRT'), openingCarryMinor: toBig(r.opening_carry_minor),
            grossCommissionMinor: toBig(r.gross_commission_minor), negativeImpactMinor: toBig(r.negative_impact_minor),
            netMinor: toBig(r.net_minor), closingCarryMinor: toBig(r.closing_carry_minor), payableMinor: toBig(r.payable_minor),
            suppressedMinor: toBig(r.suppressed_minor), floorApplied: toBool(r.floor_applied), cappedByCap: toBool(r.capped_by_cap),
            entriesCount: toNum(r.closed_entries_count), payoutId: toStrOrNull(r.payout_id), settledAt: toIso(r.settled_at),
          })) as never,
          total: toNum(count?.total),
        };
      },
      async createPayout(input) {
        const result = await db.rpc<Row>('create_affiliate_payout', {
          p_affiliate_id: input.affiliateId, p_settlement_id: input.settlementId,
          p_amount_minor: input.amountMinor.toString(), p_currency: input.currency,
          p_idempotency_key: input.idempotencyKey, p_requested_by: input.requestedBy,
          p_metadata: { method: input.method, destination_masked: input.destinationMasked },
        });
        return {
          id: toStr(result.id), publicId: toStr(result.public_id), affiliateId: input.affiliateId,
          settlementId: input.settlementId, amountMinor: toBig(result.amount_minor, input.amountMinor),
          currency: toStr(result.currency, input.currency), status: toStr(result.status, 'requested'),
          method: input.method, destinationMasked: input.destinationMasked,
          requestedBy: input.requestedBy, requestedAt: clock.now().toISOString(),
          approvedBy: null, approvedAt: null, paidAt: null, providerReference: null,
          dualApprovalRequired: toBool(result.dual_approval_required), idempotencyKey: input.idempotencyKey,
        } as never;
      },
      async updatePayoutStatus(input) {
        await db.rpc('transition_affiliate_payout', {
          p_payout_id: input.payoutId, p_status: input.status, p_reason: input.reason,
          p_provider_reference: input.providerReference ?? null,
        });
        const row = await db.queryOne<Row>(`select * from nova.affiliate_payouts where id = $1`, [input.payoutId]);
        if (!row) throw new ApiError('NOT_FOUND', 'Payout not found');
        return {
          id: toStr(row.id), publicId: toStr(row.public_id), affiliateId: toStr(row.affiliate_id),
          settlementId: toStrOrNull(row.settlement_id), amountMinor: toBig(row.amount_minor),
          currency: toStr(row.currency, 'IRT'), status: toStr(row.status),
          method: toStrOrNull(row.method), destinationMasked: toStrOrNull(row.destination_masked),
          requestedBy: toStrOrNull(row.requested_by), requestedAt: toIsoOrNull(row.requested_at),
          approvedBy: toStrOrNull(row.approved_by), approvedAt: toIsoOrNull(row.approved_at),
          paidAt: toIsoOrNull(row.paid_at), providerReference: toStrOrNull(row.provider_reference),
          dualApprovalRequired: toBool(row.dual_approval_required), idempotencyKey: toStr(row.idempotency_key),
        } as never;
      },
      async recordClick(input) {
        const affiliate = await db.queryOne<Row>(`select id from nova.affiliates where upper(code) = upper($1)`, [input.code]);
        if (!affiliate) return { clickId: null, affiliateId: null, isLikelyBot: false };
        const row = await db.queryOne<Row>(
          `insert into nova.affiliate_clicks (affiliate_id, link_id, code, ip_hash, user_agent_hash, device_fingerprint, referrer, landing_path)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, is_likely_bot`,
          [toStr(affiliate.id), input.linkId, input.code.toUpperCase(), input.ipHash, input.userAgentHash,
            input.deviceFingerprint, input.referrer, input.landingPath],
        );
        return { clickId: toStr(row!.id), affiliateId: toStr(affiliate.id), isLikelyBot: toBool(row!.is_likely_bot) };
      },
      async createAttribution(input) {
        const result = await db.rpc<Row>('attach_attribution', {
          p_user_id: input.userId, p_code: input.code, p_click_id: input.clickId,
          p_ip_hash: input.ipHash, p_device: input.deviceFingerprint,
        });
        if (!result?.attributed) return { attribution: null, rejected: true, reason: toStr(result?.reason, 'REJECTED') };
        const row = await db.queryOne<Row>(
          `select * from nova.affiliate_attributions where id = $1`, [toStr(result.attribution_id)],
        );
        return {
          attribution: row ? {
            id: toStr(row.id), userId: toStr(row.user_id), affiliateId: toStr(row.affiliate_id), code: toStr(row.code),
            campaign: toStrOrNull(row.campaign), clickId: toStrOrNull(row.click_id),
            status: toStr(row.status), confirmedAt: toIsoOrNull(row.confirmed_at), lockedAt: toIsoOrNull(row.locked_at),
            ipHash: toStrOrNull(row.ip_hash), deviceFingerprint: toStrOrNull(row.device_fingerprint), createdAt: toIso(row.created_at),
          } as never : null,
          rejected: false, reason: null,
        };
      },
      async listHierarchy(affiliateId: string) {
        const rows = await db.query<Row>(
          `select id, parent_affiliate_id, depth, coalesce(path, id::text) as path from nova.affiliates
            where id = $1 or parent_affiliate_id = $1`, [affiliateId],
        );
        return rows.map((r) => ({
          affiliateId: toStr(r.id), parentAffiliateId: toStrOrNull(r.parent_affiliate_id),
          depth: toNum(r.depth), path: toStr(r.path),
        }));
      },
    },

    /* ----------------------------------------------------------------- audit */
    audit: {
      async record(event) {
        await db.rpc('audit_event', {
          p_actor_id: event.actorId, p_action: event.action, p_target_type: event.targetType,
          p_target_id: event.targetId, p_before: event.before ?? null, p_after: event.after ?? null,
          p_reason: event.reason, p_correlation_id: event.correlationId,
          p_metadata: { actor_role: event.actorRole, ip: event.ip, user_agent: event.userAgent, ...(event.metadata ?? {}) },
        });
      },
    },

    /* --------------------------------------------------------- notifications */
    notifications: {
      async create(input) {
        const row = await db.queryOne<Row>(
          `insert into nova.notifications (user_id, type, event_key, title, body, link_path, data, channel, status, scheduled_at)
           values ($1,$2,$2,$3,$4,$5,$6::jsonb,'in_app','queued', now()) returning id`,
          [input.userId, input.type, input.title, input.body, input.linkPath ?? null, JSON.stringify(input.data ?? {})],
        );
        return { id: toStr(row!.id) };
      },
      async enqueueDelivery(input) {
        await db.query(
          `insert into nova.notification_deliveries (notification_id, channel, provider, status) values ($1,$2,$3,'pending')`,
          [input.notificationId, input.channel, input.provider],
        );
      },
    },

    logger,

    queues: {
      async enqueue(input) {
        const result = await db.rpc<Row>('enqueue_job', {
          p_queue: input.queue, p_job_key: input.jobKey, p_payload: input.payload,
          p_idempotency_key: input.idempotencyKey, p_run_at: input.runAt?.toISOString() ?? null,
          p_max_attempts: input.maxAttempts ?? 5,
        });
        return { id: toStr(result.id), duplicate: toBool(result.duplicate) };
      },
      async claim(input) {
        const rows = await db.query<Row>(`select * from nova.claim_jobs($1,$2,$3,$4)`, [input.queue, input.workerId, input.limit, input.lockTtlSeconds]);
        return rows.map((r) => ({
          id: toStr(r.id), jobKey: toStr(r.job_key), payload: toJson<Record<string, unknown>>(r.payload, {}),
          attempts: toNum(r.attempts), maxAttempts: toNum(r.max_attempts, 5),
        }));
      },
      async complete(jobId, status, error) {
        await db.rpc('complete_job', { p_job_id: jobId, p_status: status, p_error: error ?? null });
      },
      async stats(queue) {
        const rows = await db.query<Row>(
          `select status, count(*) as total from nova.job_queue where queue = $1 group by status`, [queue],
        );
        return Object.fromEntries(rows.map((r) => [toStr(r.status), toNum(r.total)]));
      },
    },
  };
  return adapters;
}

/* ------------------------------------------------------------------ mappers */

function mapUser(row: Row): DomainUserProfile {
  return {
    id: toStr(row.id), publicId: toStr(row.public_id), email: toStrOrNull(row.email), phone: toStrOrNull(row.phone),
    displayName: toStrOrNull(row.display_name), preferredLocale: toStr(row.preferred_locale, 'en'),
    preferredCurrency: toStr(row.preferred_currency, 'IRT'), timezone: toStr(row.timezone, 'Asia/Tehran'),
    role: toStr(row.role, 'user') as DomainUserProfile['role'],
    status: toStr(row.status, 'active') as DomainUserProfile['status'],
    emailVerified: toBool(row.email_verified), kycStatus: toStr(row.kyc_status, 'not_started') as DomainUserProfile['kycStatus'],
    ageVerified: toBool(row.age_verified), jurisdiction: toStrOrNull(row.jurisdiction),
    createdAt: toIso(row.created_at), lastLoginAt: toIsoOrNull(row.last_login_at),
  };
}

function mapMatch(row: Row): DomainMatch {
  return {
    id: toStr(row.id), leagueId: toStr(row.league_id), sportId: toStr(row.sport_id), seasonId: toStrOrNull(row.season_id),
    homeTeamId: toStr(row.home_team_id), awayTeamId: toStr(row.away_team_id),
    status: toStr(row.status, 'unknown') as DomainMatch['status'], clock: toStrOrNull(row.clock),
    minute: toNumOrNull(row.minute), period: toStrOrNull(row.period),
    homeScore: toNumOrNull(row.home_score), awayScore: toNumOrNull(row.away_score),
    scheduledAt: toIso(row.scheduled_at), startedAt: toIsoOrNull(row.started_at), finishedAt: toIsoOrNull(row.finished_at),
    venue: toStrOrNull(row.venue), hasLiveStream: toBool(row.has_live_stream),
  };
}

function mapSelection(row: Row): DomainSelection {
  return {
    id: toStr(row.id), marketId: toStr(row.market_id), matchId: toStr(row.match_id), code: toStr(row.code),
    name: toStr(row.name), nameFa: toStrOrNull(row.name_fa), line: toStrOrNull(row.line),
    participantType: toStr(row.participant_type, 'NEUTRAL') as DomainSelection['participantType'],
    status: toStr(row.status, 'open') as DomainSelection['status'],
    odds: toBig(row.odds_scaled, 10_100n), previousOdds: toBigOrNull(row.previous_odds_scaled),
    oddsVersion: toNum(row.odds_version, 1), oddsUpdatedAt: toIsoOrNull(row.odds_updated_at),
    provider: toStrOrNull(row.provider), providerTimestamp: toIsoOrNull(row.provider_timestamp), isStale: false,
  };
}

function mapMarket(row: Row, selections: Row[]): DomainMarket {
  return {
    id: toStr(row.id), matchId: toStr(row.match_id), type: toStr(row.type, 'OTHER') as DomainMarket['type'],
    key: toStr(row.key), name: toStr(row.name), nameFa: toStrOrNull(row.name_fa),
    status: toStr(row.status, 'open') as DomainMarket['status'], specifier: toStrOrNull(row.specifier),
    period: toStrOrNull(row.period), displayOrder: toNum(row.display_order), isLive: toBool(row.is_live),
    updatedAt: toIso(row.updated_at), selections: selections.map(mapSelection),
  };
}

function mapMatchResult(row: Row): DomainMatchResult {
  return {
    matchId: toStr(row.match_id), status: toStr(row.status, 'finished') as DomainMatchResult['status'],
    homeScore: toNumOrNull(row.home_score), awayScore: toNumOrNull(row.away_score),
    homeHalfScore: toNumOrNull(row.home_half_score), awayHalfScore: toNumOrNull(row.away_half_score),
    homeCorners: toNumOrNull(row.home_corners), awayCorners: toNumOrNull(row.away_corners),
    homeCards: toNumOrNull(row.home_cards), awayCards: toNumOrNull(row.away_cards),
    extraTime: toBool(row.extra_time), penalties: toBool(row.penalties),
    penaltyHome: toNumOrNull(row.penalty_home), penaltyAway: toNumOrNull(row.penalty_away),
    provider: toStr(row.provider, 'unknown'), providerResultId: toStrOrNull(row.provider_result_id),
    authoritative: toBool(row.authoritative, false), observedAt: new Date(toIso(row.observed_at)),
    revision: toNum(row.revision, 1),
  };
}

function mapDomainBet(row: Row): DomainBet {
  const legs = Array.isArray(row.legs) ? (row.legs as Row[]) : [];
  const currency = toStr(row.currency, 'IRT');
  return {
    id: toStr(row.id), publicId: toStr(row.public_id), userId: toStr(row.user_id),
    type: toStr(row.type, 'SINGLE') === 'MULTIPLE' ? 'MULTIPLE' : ('SINGLE' as DomainBet['type']),
    stake: money(toBig(row.stake_minor), currency),
    potentialPayout: money(toBig(row.potential_payout_minor), currency),
    combinedOddsNum: toStr(row.combined_odds_num, '1'), combinedOddsDen: toStr(row.combined_odds_den, '1'),
    combinedOddsScaled: toBig(row.combined_odds_scaled, 10_100n),
    status: mapBetStatus(toStr(row.status, 'pending')), currency,
    placementIdempotencyKey: toStr(row.placement_idempotency_key), campaign: toStrOrNull(row.campaign),
    device: toStrOrNull(row.device), affiliateId: toStrOrNull(row.affiliate_id),
    settlementAttempts: toNum(row.settlement_attempts), placedAt: toIso(row.placed_at),
    settledAt: toIsoOrNull(row.settled_at), payout: row.payout_minor === null || row.payout_minor === undefined ? null : money(toBig(row.payout_minor), currency),
    requestedSnapshot: toJson(row.requested_snapshot, {}),
    legs: legs.map((l) => ({
      id: toStr(l.id), betId: toStr(row.id), matchId: toStr(l.match_id), marketId: toStr(l.market_id),
      selectionId: toStr(l.selection_id), oddsAtPlacement: toBig(l.odds_at_placement, 10_100n),
      acceptedOdds: toBig(l.accepted_odds ?? l.odds_at_placement, 10_100n),
      status: toStr(l.status, 'pending') as DomainBet['legs'][number]['status'],
      settledAt: toIsoOrNull(l.settled_at), scoreSnapshot: null, voidReason: toStrOrNull(l.void_reason),
      selectionName: toStr(l.selection_name), marketName: toStr(l.market_name), matchLabel: toStr(l.match_label),
    })),
  };
}

function mapBetStatus(status: string): DomainBet['status'] {
  const allowed = ['pending', 'accepted', 'rejected', 'settled', 'void', 'cancelled', 'partially_settled', 'cashed_out', 'manual_review', 'reversed'];
  return (allowed.includes(status) ? status : 'accepted') as DomainBet['status'];
}

function mapWalletTransaction(row: Row, fallback?: { amount: Money; idempotencyKey: string; reason?: string | null; actorId?: string | null; reference?: string | null; metadata?: Record<string, unknown> }): DomainWalletTransaction {
  const currency = toStr(row.currency, 'IRT');
  return {
    id: toStr(row.transaction_id ?? row.id), walletId: toStr(row.wallet_id), userId: toStr(row.user_id),
    type: toStr(row.type, 'adjustment') as DomainWalletTransaction['type'],
    amount: row.amount_minor === undefined ? (fallback?.amount ?? money(0n, currency)) : money(toBig(row.amount_minor), currency),
    balanceAfter: money(toBig(row.balance_after_minor), currency),
    status: toStr(row.status, 'posted') as DomainWalletTransaction['status'],
    reference: toStrOrNull(row.reference ?? fallback?.reference), betId: toStrOrNull(row.bet_id),
    paymentTransactionId: toStrOrNull(row.payment_transaction_id), reversalOf: toStrOrNull(row.reversal_of),
    idempotencyKey: toStr(row.idempotency_key, fallback?.idempotencyKey ?? ''),
    reason: toStrOrNull(row.reason ?? fallback?.reason), actorId: toStrOrNull(row.actor_id ?? fallback?.actorId),
    metadata: toJson<Record<string, unknown>>(row.metadata, fallback?.metadata ?? {}), createdAt: toIso(row.created_at ?? new Date()),
  };
}

function mapSettlementJob(row: Row): SettlementJob {
  return {
    id: toStr(row.id), betId: toStr(row.bet_id), userId: toStr(row.user_id),
    status: toStr(row.status, 'queued') as SettlementJob['status'], attempts: toNum(row.attempts),
    reason: toStrOrNull(row.reason), createdAt: toIso(row.created_at), processedAt: toIsoOrNull(row.processed_at),
  };
}

function mapAffiliate(row: Row): DomainAffiliate {
  const currency = toStr(row.currency, 'IRT');
  return {
    id: toStr(row.id), userId: toStr(row.user_id), publicId: toStr(row.public_id), code: toStr(row.code),
    slug: toStr(row.slug, toStr(row.code).toLowerCase()), displayName: toStrOrNull(row.display_name),
    status: toStr(row.status, 'pending') as DomainAffiliate['status'],
    commissionModel: toStr(row.commission_model, 'NON_NEGATIVE_35') as DomainAffiliate['commissionModel'],
    commissionRateBps: toNum(row.commission_rate_bps, 3500), allowNegativeBalance: toBool(row.allow_negative_balance),
    negativeBalanceFloor: toBig(row.negative_balance_floor_minor), minPayout: money(toBig(row.min_payout_minor, 5_000_000n), currency),
    maxPayout: row.max_payout_minor === null || row.max_payout_minor === undefined ? null : money(toBig(row.max_payout_minor), currency),
    parentAffiliateId: toStrOrNull(row.parent_affiliate_id), depth: toNum(row.depth),
    parentOverrideBps: toNum(row.parent_override_bps),
    netBpsCapBps: row.total_net_bps_cap === null || row.total_net_bps_cap === undefined ? null : toNum(row.total_net_bps_cap),
    settlementDayIso: toNum(row.settlement_day_iso, 5), settlementHour: toNum(row.settlement_hour, 3),
    settlementMinute: toNum(row.settlement_minute), settlementTimezone: toStr(row.settlement_timezone, 'Asia/Tehran'),
    autoPayoutEnabled: toBool(row.auto_payout_enabled), createdAt: toIso(row.created_at),
    approvedAt: toIsoOrNull(row.approved_at),
  };
}

function mapAffiliateLedger(row: Row): DomainAffiliateLedgerEntry {
  return {
    id: toStr(row.id), affiliateId: toStr(row.affiliate_id),
    type: toStr(row.type, 'adjustment') as DomainAffiliateLedgerEntry['type'],
    amount: toBig(row.amount_minor), currency: toStr(row.currency, 'IRT'),
    direction: toBig(row.amount_minor) >= 0n ? 'credit' : 'debit',
    commissionRateBps: toNum(row.commission_rate_bps, 3500), sourceAmount: toBig(row.source_amount_minor),
    sourceKind: toStr(row.source_kind, 'bet_settlement') as DomainAffiliateLedgerEntry['sourceKind'],
    userId: toStrOrNull(row.user_id), betId: toStrOrNull(row.bet_id), betSettlementId: toStrOrNull(row.bet_settlement_id),
    settlementId: toStrOrNull(row.settlement_id), payoutId: toStrOrNull(row.payout_id),
    appliedRateBps: toNum(row.applied_rate_bps, 3500), capApplied: toBool(row.cap_applied),
    status: toStr(row.status, 'available') as DomainAffiliateLedgerEntry['status'],
    idempotencyKey: toStr(row.idempotency_key), createdAt: toIso(row.created_at), settledAt: toIsoOrNull(row.settled_at),
    metadata: toJson<Record<string, unknown>>(row.metadata, {}),
  };
}

type DomainAffiliateLedgerEntry = import('@/domain/types').AffiliateLedgerEntry;
type MappingFn = (row: Row) => OddsRecord;

/** Exposed for tests: map an odds_history row into the domain record shape. */
export const mapOddsRecord: MappingFn = (row) => ({
  selectionId: toStr(row.selection_id), provider: toStr(row.provider, 'unknown'),
  odds: toBig(row.odds_scaled, 10_100n), previousOdds: toBigOrNull(row.previous_odds_scaled),
  oddsVersion: toNum(row.odds_version, 1), providerTimestamp: new Date(toIso(row.provider_timestamp ?? row.ingested_at)),
  ingestedAt: new Date(toIso(row.ingested_at)), isLive: toBool(row.is_live),
  status: toStr(row.status, 'open') as OddsRecord['status'],
});
