/**
 * NOVA - PORTS (hexagonal boundary)
 *
 * The domain layer depends ONLY on these interfaces. Adapters:
 *   - src/server/adapters/postgres/*      (production: Supabase Postgres + SQL RPC)
 *   - src/server/adapters/dev/*           (development/test ONLY, feature-gated, refuses production)
 *   - src/providers/*                     (external sports/payment/notification providers)
 *
 * This is what makes the financial core unit-testable without a database and makes
 * "no fake production data" enforceable: the dev adapters are unreachable in production.
 */
import type { Money } from './money';
import type {
  AffiliateAttribution, Bet, GradedLeg, LedgerEntryRequest,
  LedgerEntryResult, Market, Match, OddsRecord, PlaceBetRequest, PlaceBetResult, Selection,
  SettlementOutcome, UserProfile, Wallet, WalletTransaction, MatchResult, SettlementJob,
  Affiliate, AffiliateLedgerEntry, AffiliateSettlement, AffiliatePayout, ReferredUserStats,
} from './types';

export interface DomainErrorLike {
  code: string;
  message: string;
}

/* ---------------- Time / ids ---------------- */
export interface IdGenerator {
  uuid(): string;
  publicId(prefix: string): string;
}

/* ---------------- System state ---------------- */
export interface SystemStatePort {
  isMaintenanceMode(): Promise<boolean>;
  getOperationState(op: string): Promise<boolean>; // true = enabled
  setOperationState(op: string, enabled: boolean, actorId: string | null, reason: string): Promise<void>;
  getFeatureFlags(): Promise<Record<string, boolean>>;
}

/* ---------------- Users ---------------- */
export interface UserPort {
  getById(userId: string): Promise<UserProfile | null>;
  getByEmail(email: string): Promise<UserProfile | null>;
  getByPublicId(publicId: string): Promise<UserProfile | null>;
  /** Server-authoritative transaction gate (status, self-exclusion, cooling-off, age, KYC). */
  checkCanTransact(userId: string, kind: 'bet' | 'deposit' | 'withdraw'): Promise<{ allowed: boolean; reason: string | null; code: string | null }>;
  listRestrictions(userId: string): Promise<{ kind: string; reason: string; until: string | null }[]>;
}

/* ---------------- Sports catalogue ---------------- */
export interface SportsPort {
  getMatch(matchId: string): Promise<Match | null>;
  getMatchesByIds(matchIds: string[]): Promise<Match[]>;
  getMarket(marketId: string): Promise<Market | null>;
  getSelection(selectionId: string): Promise<Selection | null>;
  /** Bulk authoritative read used by the betting engine (single round trip, row locks). */
  getSelectionsForBetting(selectionIds: string[]): Promise<{
    selection: Selection; market: Market; match: Match;
  }[]>;
  getOddsFreshnessSeconds(): Promise<{ prematch: number; live: number }>;
}

/* ---------------- Wallet ---------------- */
export interface WalletPort {
  /** Post an immutable ledger entry atomically. Must be idempotent on idempotencyKey. */
  postEntry(entry: LedgerEntryRequest): Promise<LedgerEntryResult>;
  getWallet(userId: string, currency: string): Promise<Wallet | null>;
  listTransactions(userId: string, opts: { limit: number; cursor?: string | null; types?: string[] }): Promise<{ items: WalletTransaction[]; nextCursor: string | null }>;
  /** Sum of posted entries for a user - used by reconciliation. */
  ledgerSumMinor(userId: string, currency: string): Promise<bigint>;
}

/* ---------------- Betting ---------------- */
export interface BettingPort {
  /**
   * Atomically: lock wallet -> read authoritative selections -> validate -> debit -> create bet+legs
   * -> ledger -> audit. Implemented as SQL function nova.place_bet (see migrations 0060).
   */
  placeBetAtomic(input: {
    userId: string;
    request: PlaceBetRequest;
    riskApprovedStakeMinor: bigint | null;
    correlationId: string;
    context: { ip: string | null; userAgent: string | null; device: string | null };
  }): Promise<PlaceBetResult>;
  findByIdempotencyKey(userId: string, key: string): Promise<Bet | null>;
  getBet(betId: string): Promise<Bet | null>;
  getBetByPublicId(publicId: string): Promise<Bet | null>;
  listBets(userId: string, opts: { limit: number; cursor?: string | null; status?: string | null }): Promise<{ items: Bet[]; nextCursor: string | null }>;
  /** Exposure = potential payout of unresolved bets, per selection/market/match. */
  exposureForSelections(selectionIds: string[]): Promise<{ selectionId: string; stakeMinor: bigint; payoutMinor: bigint; betCount: number }[]>;
  dailyStakeMinor(userId: string, currency: string, since: Date): Promise<bigint>;
  dailyPayoutMinor(userId: string, currency: string, since: Date): Promise<bigint>;
}

/* ---------------- Settlement ---------------- */
export interface SettlementPort {
  /** Authoritative result for a match (from provider or authorised manual entry). */
  getMatchResult(matchId: string): Promise<MatchResult | null>;
  enqueueForMatch(matchId: string, reason: string): Promise<number>;
  claimJobs(workerId: string, limit: number): Promise<SettlementJob[]>;
  /**
   * Idempotent settlement of a single bet:
   *   leg grading -> bet status -> atomic wallet credit -> ledger -> audit -> affiliate commission.
   * Implemented as nova.settle_bet.
   */
  settleBetAtomic(input: {
    betId: string;
    gradedLegs: GradedLeg[];
    payoutMinor: bigint;
    currency: string;
    correlationId: string;
    workerId: string;
    resultRevision: number;
  }): Promise<SettlementOutcome>;
  completeJob(
    jobId: string,
    workerId: string,
    status: 'done' | 'failed' | 'manual_review',
    error?: string | null,
  ): Promise<void>;
  listSettlementQueue(opts: { status?: string; limit: number; page: number }): Promise<{ items: SettlementJob[]; total: number }>;
  /** Bets whose legs are all graded but bet row is not settled (crash recovery). */
  findStuckBets(limit: number): Promise<Bet[]>;
  reverseBetSettlement(input: { betId: string; reason: string; actorId: string; correlationId: string }): Promise<{ reversed: boolean; ledgerTransactionId: string | null }>;
}

/* ---------------- Affiliate ---------------- */
export interface AffiliatePort {
  getByUserId(userId: string): Promise<Affiliate | null>;
  getById(affiliateId: string): Promise<Affiliate | null>;
  getByCode(code: string): Promise<Affiliate | null>;
  resolveEffectiveConfig(affiliateId: string, sportId?: string | null, campaign?: string | null): Promise<{
    commissionModel: string; commissionRateBps: number; allowNegativeBalance: boolean;
    negativeBalanceFloorMinor: bigint; minPayoutMinor: bigint; maxPayoutMinor: bigint | null;
    parentOverrideBps: number; netCapBps: number | null; source: string;
  }>;
  /** Immutable affiliate ledger write. Idempotent on idempotencyKey. Never mutates history. */
  postLedgerEntries(entries: Omit<AffiliateLedgerEntry, 'id' | 'createdAt' | 'settledAt'>[]): Promise<{ inserted: number; skipped: number }>;
  listLedger(affiliateId: string, opts: { limit: number; cursor?: string | null; type?: string | null }): Promise<{ items: AffiliateLedgerEntry[]; nextCursor: string | null }>;
  getStats(affiliateId: string): Promise<ReferredUserStats>;
  /** Aggregate ledger balance WITHOUT floor-zero (raw). */
  rawBalanceMinor(affiliateId: string): Promise<{ currency: string; minor: bigint }>;
  /** Payable balance: floor-zero when the affiliate's model is NON_NEGATIVE. */
  payableBalanceMinor(affiliateId: string): Promise<{ currency: string; payable: bigint; raw: bigint; floorApplied: boolean }>;
  createSettlement(input: {
    affiliateId: string; periodStart: Date; periodEnd: Date; workerId: string; correlationId: string;
  }): Promise<AffiliateSettlement>;
  listSettlements(affiliateId: string, opts: { limit: number; page: number }): Promise<{ items: AffiliateSettlement[]; total: number }>;
  createPayout(input: {
    affiliateId: string; settlementId: string | null; amountMinor: bigint; currency: string;
    idempotencyKey: string; requestedBy: string; method: string | null; destinationMasked: string | null;
  }): Promise<AffiliatePayout>;
  updatePayoutStatus(input: {
    payoutId: string; status: string; actorId: string; reason: string | null;
    providerReference?: string | null; dualApprovalRequired?: boolean;
  }): Promise<AffiliatePayout>;
  /** Attribution is server-authoritative and immutable once confirmed. */
  recordClick(input: {
    code: string; linkId: string | null; ipHash: string | null; userAgentHash: string | null;
    deviceFingerprint: string | null; referrer: string | null; landingPath: string;
  }): Promise<{ clickId: string | null; affiliateId: string | null; isLikelyBot: boolean }>;
  createAttribution(input: {
    userId: string; code: string; clickId: string | null; ipHash: string | null;
    deviceFingerprint: string | null; correlationId: string;
  }): Promise<{ attribution: AffiliateAttribution | null; rejected: boolean; reason: string | null }>;
  listHierarchy(affiliateId: string): Promise<{ affiliateId: string; parentAffiliateId: string | null; depth: number; path: string }[]>;
}

/* ---------------- Audit / observability ---------------- */
export interface AuditPort {
  record(event: {
    actorId: string | null; actorRole: string | null; action: string; targetType: string;
    targetId: string | null; before: unknown; after: unknown; reason: string | null;
    correlationId: string | null; ip: string | null; userAgent: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

/* ---------------- Notifications ---------------- */
export interface NotificationPort {
  create(input: {
    userId: string; type: string; title: string; body: string; linkPath?: string | null;
    data?: Record<string, unknown>; channel?: string;
  }): Promise<{ id: string }>;
  enqueueDelivery(input: { notificationId: string; channel: string; provider: string }): Promise<void>;
}

/* ---------------- Payments ---------------- */
export interface PaymentPort {
  createIntent(input: {
    userId: string; type: 'deposit' | 'withdrawal'; amount: Money; idempotencyKey: string;
    returnUrl: string; callbackUrl: string; correlationId: string;
  }): Promise<import('./types').PaymentIntent>;
  verifyCallback(input: { headers: Record<string, string>; rawBody: string }): Promise<import('./types').PaymentCallback>;
  applyCallback(callback: import('./types').PaymentCallback): Promise<{ applied: boolean; duplicate: boolean; transactionId: string | null }>;
}

/* ---------------- Queues ---------------- */
export interface QueuePort {
  enqueue(input: {
    queue: string; jobKey: string; payload: Record<string, unknown>;
    idempotencyKey: string; runAt?: Date; maxAttempts?: number;
  }): Promise<{ id: string; duplicate: boolean }>;
  claim(input: { queue: string; workerId: string; limit: number; lockTtlSeconds: number }): Promise<{
    id: string; jobKey: string; payload: Record<string, unknown>; attempts: number; maxAttempts: number;
  }[]>;
  complete(jobId: string, status: 'succeeded' | 'failed' | 'dead_letter', error?: string | null): Promise<void>;
  stats(queue: string): Promise<Record<string, number>>;
}

/* ---------------- Full adapter bundle ---------------- */
export interface DomainAdapters {
  clock: import('./time').Clock;
  ids: IdGenerator;
  users: UserPort;
  sports: SportsPort;
  wallet: WalletPort;
  betting: BettingPort;
  settlement: SettlementPort;
  affiliate: AffiliatePort;
  audit: AuditPort;
  notifications: NotificationPort;
  system: SystemStatePort;
  logger: Logger;
  queues?: QueuePort;
}

/** Additional shape used to report a wallet credit back to the caller. */
export interface CreditedWalletResult extends LedgerEntryResult {
  currency: string;
}
