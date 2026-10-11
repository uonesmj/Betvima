import type { Db } from '@/lib/ports/db';
import type {
  BettingRepository, BetFilter, ManualSettleInput, PlaceBetInput, PlaceBetResult, ReverseSettlementInput,
  ReverseSettlementResult, SettleBetInput, SettleBetResult,
} from '@/lib/ports/repositories';
import type { Bet, BetLeg, CashoutQuote, Currency, Paginated, UUID } from '@/lib/types';
import { ApiError } from '@/lib/errors';
import { pgArray, type Row, toBig, toBigOrNull, toIso, toIsoOrNull, toNum, toStr, toStrOrNull } from '@/server/db/rows';

/** The complete bet projection used by every read path (single SQL source of truth). */
const BET_SELECT = `
  select b.id, b.public_id, b.user_id, b.type::text as type, b.status::text as status, b.currency,
         b.stake_minor, b.potential_payout_minor, b.payout_minor, b.combined_odds_scaled,
         b.result_revision, b.placed_at, b.settled_at, b.affiliate_id, b.device, b.updated_at,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'selection_id', l.selection_id, 'market_id', l.market_id, 'match_id', l.match_id,
           'odds_at_placement', l.odds_at_placement, 'accepted_odds', l.accepted_odds, 'status', l.status::text,
           'grade_reason', l.grade_reason, 'settled_at', l.settled_at,
           'selection_name', l.selection_name,
           'market_name', l.market_name,
           'match_label', l.match_label,
           'match', jsonb_build_object(
             'league_name_fa', lg.name_fa,
             'league_name', lg.name,
             'league_logo', lg.logo,
             'home_team_name_fa', ht.name_fa,
             'home_team_name', ht.name,
             'home_team_short', ht.short_name,
             'home_team_logo', ht.logo,
             'away_team_name_fa', at.name_fa,
             'away_team_name', at.name,
             'away_team_short', at.short_name,
             'away_team_logo', at.logo,
             'scheduled_at', m.scheduled_at,
             'status', m.status::text,
             'clock', m.clock,
             'minute', m.minute,
             'period', m.period,
             'home_score', m.home_score,
             'away_score', m.away_score,
             'venue', m.venue
           )
         ) order by l.created_at) filter (where l.id is not null), '[]'::jsonb) as legs
    from nova.bets b
    left join nova.bet_legs l on l.bet_id = b.id
    left join nova.matches m on m.id = l.match_id
    left join nova.teams ht on ht.id = m.home_team_id
    left join nova.teams at on at.id = m.away_team_id
    left join nova.leagues lg on lg.id = m.league_id`;
export function mapBet(row: Row): Bet {
  const legsRaw = Array.isArray(row.legs) ? (row.legs as Row[]) : [];
  const legs: BetLeg[] = legsRaw.map((l) => ({
    id: toStr(l.id), betId: toStr(row.id), matchId: toStr(l.match_id), marketId: toStr(l.market_id),
    selectionId: toStr(l.selection_id), matchLabel: toStr(l.match_label), marketLabel: toStr(l.market_name),
    selectionLabel: toStr(l.selection_name), oddsAtPlacementScaled: toBig(l.odds_at_placement, 10_100n),
    acceptedOddsScaled: toBigOrNull(l.accepted_odds), status: toStr(l.status, 'pending') as BetLeg['status'],
    grade: (toStrOrNull(l.grade_reason) ? (toStr(l.grade_reason).split(':')[0] as BetLeg['grade']) : null),
    settledAt: toIsoOrNull(l.settled_at),
    match: {
      leagueName: toStrOrNull((l.match as Row | undefined)?.league_name_fa) ?? toStrOrNull((l.match as Row | undefined)?.league_name),
      leagueLogoUrl: toStrOrNull((l.match as Row | undefined)?.league_logo),
      homeTeamName: toStrOrNull((l.match as Row | undefined)?.home_team_name_fa) ?? toStrOrNull((l.match as Row | undefined)?.home_team_name),
      homeTeamShortName: toStrOrNull((l.match as Row | undefined)?.home_team_short),
      homeTeamLogoUrl: toStrOrNull((l.match as Row | undefined)?.home_team_logo),
      awayTeamName: toStrOrNull((l.match as Row | undefined)?.away_team_name_fa) ?? toStrOrNull((l.match as Row | undefined)?.away_team_name),
      awayTeamShortName: toStrOrNull((l.match as Row | undefined)?.away_team_short),
      awayTeamLogoUrl: toStrOrNull((l.match as Row | undefined)?.away_team_logo),
      scheduledAt: toIsoOrNull((l.match as Row | undefined)?.scheduled_at),
      status: toStrOrNull((l.match as Row | undefined)?.status),
      clock: toStrOrNull((l.match as Row | undefined)?.clock),
      minute: (l.match as Row | undefined)?.minute == null ? null : toNum((l.match as Row).minute),
      period: toStrOrNull((l.match as Row | undefined)?.period),
      homeScore: (l.match as Row | undefined)?.home_score == null ? null : toNum((l.match as Row).home_score),
      awayScore: (l.match as Row | undefined)?.away_score == null ? null : toNum((l.match as Row).away_score),
      venue: toStrOrNull((l.match as Row | undefined)?.venue),
    },
  }));
  const status = toStr(row.status, 'pending') as Bet['status'];
  return {
    id: toStr(row.id), publicId: toStr(row.public_id), userId: toStr(row.user_id),
    type: toStr(row.type, 'SINGLE') as Bet['type'], status,
    currency: toStr(row.currency, 'IRT') as Currency, stakeMinor: toBig(row.stake_minor),
    potentialPayoutMinor: toBig(row.potential_payout_minor), settledPayoutMinor: toBigOrNull(row.payout_minor),
    netResultMinor: row.payout_minor === null ? null : toBig(row.payout_minor) - toBig(row.stake_minor),
    combinedOddsScaled: toBig(row.combined_odds_scaled, 10_100n), legs,
    placedAt: toIso(row.placed_at), settledAt: toIsoOrNull(row.settled_at),
    revision: toNum(row.result_revision, 1), isLive: legs.some((l) => l.status === 'pending'),
    isCashoutAvailable: false, cashoutValueMinor: null,
    affiliateId: toStrOrNull(row.affiliate_id), source: (toStr(row.device, 'web') as Bet['source']),
  };
}

export class PostgresBettingRepository implements BettingRepository {
  constructor(readonly db: Db) {}

  async placeBet(input: PlaceBetInput): Promise<PlaceBetResult> {
    const result = await this.db.rpc<Row>('place_bet', {
      p_user_id: input.userId,
      p_idempotency_key: input.idempotencyKey,
      p_mode: input.payload.type,
      p_stake_minor: input.payload.stakeMinor,
      p_currency: input.payload.currency,
      p_funding_source: input.payload.fundingSource ?? 'main',
      p_bonus_grant_id: input.payload.bonusGrantId ?? null,
      p_selections: input.payload.legs.map((leg) => ({
        match_id: leg.matchId, market_id: leg.marketId, selection_id: leg.selectionId,
        odds_seen: leg.clientOddsScaled ?? null, odds_version: leg.marketVersion ?? null,
      })),
      p_accept_odds_change: input.payload.legs.some((leg) => leg.acceptOddsChange),
      p_device: input.payload.source ?? 'web',
      p_campaign: null,
      p_correlation_id: input.actor.correlationId ?? null,
      p_ip_hash: null,
      p_user_agent: null,
    });
    const bet = mapBet((result.bet as Row) ?? {});
    const replay = Boolean(result.idempotent_replay);
    return {
      status: replay ? 'idempotent_replay' : 'accepted',
      bet,
      balanceAfterMinor: toBig(result.wallet_balance_minor),
      quote: {
        combinedOddsScaled: bet.combinedOddsScaled,
        potentialPayoutMinor: bet.potentialPayoutMinor,
        warnings: [],
      },
    };
  }

  async listBets(_c: unknown, filter: BetFilter & { userId?: UUID }): Promise<Paginated<Bet>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const sortColumn = filter.sortBy === 'stake_minor' ? 'b.stake_minor'
      : filter.sortBy === 'potential_payout_minor' ? 'b.potential_payout_minor' : 'b.placed_at';
    const direction = filter.sortDirection === 'asc' ? 'asc' : 'desc';
    const params = [
      filter.userId ?? null, filter.status ? pgArray(filter.status) : null, filter.type ?? null, filter.from ?? null, filter.to ?? null,
      filter.currency ?? null, filter.minStakeMinor?.toString() ?? null, filter.maxStakeMinor?.toString() ?? null,
      filter.search ?? null, pageSize, (page - 1) * pageSize,
    ];
    const where = `
      where ($1::uuid is null or b.user_id = $1)
        and ($2::text[] is null or b.status::text = any($2))
        and ($3::text is null or b.type::text = $3)
        and ($4::timestamptz is null or b.placed_at >= $4)
        and ($5::timestamptz is null or b.placed_at <= $5)
        and ($6::text is null or b.currency = $6)
        and ($7::bigint is null or b.stake_minor >= $7)
        and ($8::bigint is null or b.stake_minor <= $8)
        and ($9::text is null or b.public_id ilike '%' || $9 || '%'
             or exists (select 1 from nova.bet_legs l where l.bet_id = b.id and (l.match_label ilike '%' || $9 || '%' or l.selection_name ilike '%' || $9 || '%')))`;
    const rows = await this.db.query<Row>(`${BET_SELECT} ${where} group by b.id order by ${sortColumn} ${direction} limit $10 offset $11`, params);
    const countRow = await this.db.queryOne<Row>(`select count(*) as total from nova.bets b ${where}`, params.slice(0, 9));
    const total = toNum(countRow?.total);
    return { items: rows.map(mapBet), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getBet(_c: unknown, betId: UUID, userId?: UUID | null): Promise<Bet | null> {
    const row = await this.db.queryOne<Row>(
      `${BET_SELECT} where (b.id::text = $1 or b.public_id = $1) and ($2::uuid is null or b.user_id = $2) group by b.id`, [betId, userId ?? null],
    );
    return row ? mapBet(row) : null;
  }

  async getBetByPublicId(_c: unknown, publicId: string): Promise<Bet | null> {
    return this.getBet(null, publicId, null);
  }

  async acceptCashout(_c: unknown, input: { betId: UUID; quoteId: UUID; userId: UUID; idempotencyKey: string }): Promise<{ betId: UUID; offerMinor: bigint; balanceAfterMinor: bigint; replay: boolean }> {
    const result = await this.db.rpc<Row>('accept_cashout', {
      p_bet_id: input.betId, p_quote_id: input.quoteId, p_user_id: input.userId, p_idempotency_key: input.idempotencyKey,
    });
    const status = toStr(result?.status, 'accepted');
    return {
      betId: input.betId, offerMinor: toBig(result?.offer_minor),
      balanceAfterMinor: toBig(result?.balance_after_minor), replay: status === 'idempotent_replay',
    };
  }

  async getCashoutQuote(_c: unknown, betId: UUID, userId: UUID): Promise<CashoutQuote> {
    const bet = await this.getBet(null, betId, userId);
    if (!bet) throw new ApiError('BET_NOT_FOUND');
    const result = await this.db.rpc<Row>('cashout_quote', { p_bet_id: betId, p_user_id: userId, p_margin_bps: 500, p_ttl_seconds: 60 });
    const available = Boolean(result?.available);
    if (!available) {
      const reason = toStr(result?.reason, 'FEATURE_DISABLED');
      return {
        betId, available: false, reason, offerMinor: null, originalStakeMinor: bet.stakeMinor,
        potentialPayoutMinor: bet.potentialPayoutMinor, expiresAt: null, margin: null,
      };
    }
    return {
      betId, available: true, offerMinor: toBig(result.offer_minor), originalStakeMinor: bet.stakeMinor,
      potentialPayoutMinor: bet.potentialPayoutMinor, expiresAt: toIso(result.expires_at),
      margin: toNum(result.margin_bps) / 10_000, quoteId: toStr(result.quote_id, ''),
    };
  }

  async cancelBet(): Promise<Bet> {
    // Bets are cancelled through the admin/settlement paths (there is no client-side
    // "cancel my bet" - that would be client authority over a financial record).
    throw new ApiError('FORBIDDEN', 'Bets cannot be cancelled by the client');
  }

  async settleBet(input: SettleBetInput): Promise<SettleBetResult> {
    // The currency is read from the bet itself: the client never supplies it and the
    // settlement row cannot be written without it.
    const betRow = await this.db.queryOne<Row>(`select currency, result_revision from nova.bets where id = $1`, [input.betId]);
    if (!betRow) throw new ApiError('BET_NOT_FOUND');
    const result = await this.db.rpc<Row>('settle_bet', {
      p_bet_id: input.betId,
      p_graded_legs: input.legs.map((l) => ({ selection_id: l.selectionId, grade: l.grade, reason: input.note ?? input.source })),
      p_payout_minor: input.payoutMinor,
      p_currency: toStr(betRow.currency, 'IRT'),
      p_revision: input.revision,
      p_worker: input.source,
      p_operator_id: input.actorId ?? null,
      p_notes: input.note ?? null,
    });
    return {
      settlementId: toStr(result.settlement_id), status: toStr(result.status, 'settled') as SettleBetResult['status'],
      payoutMinor: toBig(result.payout_minor), netUserResultMinor: toBig(result.net_user_result_minor),
      balanceAfterMinor: toBigOrNull(result.balance_after_minor), betRevision: toNum(result.bet_revision, input.revision),
    };
  }

  async reverseSettlement(input: ReverseSettlementInput): Promise<ReverseSettlementResult> {
    const result = await this.db.rpc<Row>('reverse_bet_settlement', {
      p_bet_id: input.betId, p_reason: input.reason, p_actor_id: input.actorId, p_correlation_id: input.idempotencyKey,
    });
    return {
      betId: toStr(result.bet_id, input.betId), reversedSettlementId: toStr(result.reversed_settlement_id, input.settlementId),
      reversalEntryId: toStrOrNull(result.reversal_entry_id), affiliateReversals: toNum(result.affiliate_reversals),
    };
  }

  async manualSettle(input: ManualSettleInput): Promise<{ bet: Bet; balanceAfterMinor?: bigint | null }> {
    const result = await this.db.rpc<Row>('manual_settle_decision', {
      p_bet_id: input.betId, p_decision: input.decision, p_reason: input.reason, p_correlation_id: input.idempotencyKey,
    });
    const bet = await this.getBet(null, input.betId, null);
    if (!bet) throw new ApiError('BET_NOT_FOUND');
    return { bet, balanceAfterMinor: toBigOrNull(result?.balance_after_minor) };
  }

  async listSettlementCandidates(limit: number): Promise<{ betId: UUID; matchId: UUID; legIds: UUID[] }[]> {
    const rows = await this.db.query<Row>(
      `select b.id as bet_id, min(l.match_id) as match_id, array_agg(l.id) as leg_ids
         from nova.bets b join nova.bet_legs l on l.bet_id = b.id
        where b.status in ('accepted','partially_settled') and l.status = 'pending'
          and exists (select 1 from nova.matches m where m.id = l.match_id and m.status = 'finished')
        group by b.id limit $1`, [limit],
    );
    return rows.map((r) => ({
      betId: toStr(r.bet_id), matchId: toStr(r.match_id),
      legIds: Array.isArray(r.leg_ids) ? (r.leg_ids as unknown[]).map((v) => toStr(v)) : [],
    }));
  }

  async listOpenBetsForMatch(matchId: UUID): Promise<Bet[]> {
    const rows = await this.db.query<Row>(
      `${BET_SELECT} where b.status in ('accepted','partially_settled')
         and exists (select 1 from nova.bet_legs l2 where l2.bet_id = b.id and l2.match_id = $1 and l2.status = 'pending')
       group by b.id`, [matchId],
    );
    return rows.map(mapBet);
  }

  async dailyStakeForUser(userId: UUID, currency: Currency, dayKey: string): Promise<bigint> {
    const row = await this.db.queryOne<Row>(
      `select coalesce(sum(stake_minor),0) as total from nova.bets
        where user_id = $1 and currency = $2 and placed_at >= $3::date and placed_at < ($3::date + interval '1 day')
          and status not in ('rejected','cancelled')`,
      [userId, currency, dayKey],
    );
    return toBig(row?.total);
  }

  async openBetCount(userId: UUID): Promise<number> {
    const row = await this.db.queryOne<Row>(
      `select count(*) as total from nova.bets where user_id = $1 and status in ('accepted','partially_settled','pending')`, [userId],
    );
    return toNum(row?.total);
  }

  async exposureForUser(userId: UUID, currency: Currency): Promise<bigint> {
    const row = await this.db.queryOne<Row>(
      `select coalesce(sum(potential_payout_minor),0) as total from nova.bets
        where user_id = $1 and currency = $2 and status in ('accepted','partially_settled')`, [userId, currency],
    );
    return toBig(row?.total);
  }
}
