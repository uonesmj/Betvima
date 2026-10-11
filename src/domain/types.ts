/**
 * NOVA SPORTSBOOK - CANONICAL DOMAIN TYPES
 * These types are the single contract shared by: UI -> API/service layer -> domain -> RPC.
 * Anything not present here must not exist in a React component (rule 91).
 */
import type { Money } from './money';
import type { OddsScaled } from './odds';

/* ------------------------------------------------------------------ */
/* Identity                                                           */
/* ------------------------------------------------------------------ */

export type Uuid = string;
/** Prefixed, human-supportable IDs exposed to users/admin (e.g. NB-8F3K2Q9A). */
export type PublicId = string;

export type UserRole =
  | 'user' | 'affiliate' | 'support' | 'finance' | 'risk_manager'
  | 'settlement_manager' | 'trader' | 'affiliate_manager' | 'admin' | 'super_admin';

export const ADMIN_ROLES: readonly UserRole[] = [
  'support', 'finance', 'risk_manager', 'settlement_manager',
  'trader', 'affiliate_manager', 'admin', 'super_admin',
];

export const isAdminRole = (role: UserRole): boolean => ADMIN_ROLES.includes(role);

export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'closed' | 'self_excluded';

export interface UserProfile {
  id: Uuid;
  publicId: PublicId;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  preferredLocale: string;
  preferredCurrency: string;
  timezone: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  kycStatus: KycStatus;
  ageVerified: boolean;
  jurisdiction: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected' | 'expired';

/* ------------------------------------------------------------------ */
/* Auth / session                                                     */
/* ------------------------------------------------------------------ */

export interface AuthSession {
  userId: Uuid;
  sessionId: Uuid;
  role: UserRole;
  email: string | null;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthenticatedActor {
  userId: Uuid;
  sessionId: Uuid;
  role: UserRole;
  /** true when the account is allowed to bet/deposit/withdraw. */
  canTransact: boolean;
}

export interface RequestContext {
  requestId: string;
  correlationId: string;
  actor: AuthenticatedActor | null;
  ip: string | null;
  userAgent: string | null;
  /** Raw referral cookie value (auxiliary only - server attribution is authoritative). */
  referralCode: string | null;
}

/* ------------------------------------------------------------------ */
/* Sports data                                                        */
/* ------------------------------------------------------------------ */

export type MatchStatus =
  | 'scheduled' | 'live' | 'paused' | 'finished' | 'postponed'
  | 'cancelled' | 'abandoned' | 'interrupted' | 'rescheduled' | 'cancelled_weather';

/** Statuses that allow pre-match betting. */
export const PREMATCH_ALLOWED: readonly MatchStatus[] = ['scheduled', 'rescheduled'];
/** Statuses that allow in-play betting. */
export const LIVE_ALLOWED: readonly MatchStatus[] = ['live', 'paused'];
/** Terminal match statuses that trigger settlement evaluation. */
export const SETTLEMENT_TRIGGER: readonly MatchStatus[] = ['finished', 'cancelled', 'abandoned', 'postponed', 'interrupted'];

export interface Sport {
  id: Uuid;
  slug: string;
  nameEn: string;
  nameFa: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  /** Number of currently available events - derived, never fabricated. */
  eventCount?: number;
}

export interface Country {
  id: Uuid;
  code: string;
  nameEn: string;
  nameFa: string | null;
  flag: string | null;
}

export interface League {
  id: Uuid;
  sportId: Uuid;
  countryId: Uuid | null;
  slug: string;
  name: string;
  nameFa: string | null;
  tier: number | null;
  isActive: boolean;
  logo: string | null;
  eventCount?: number;
}

export interface Team {
  id: Uuid;
  sportId: Uuid;
  countryId: Uuid | null;
  slug: string;
  name: string;
  nameFa: string | null;
  shortName: string | null;
  logo: string | null;
}

export interface Match {
  id: Uuid;
  leagueId: Uuid;
  sportId: Uuid;
  seasonId: Uuid | null;
  homeTeamId: Uuid;
  awayTeamId: Uuid;
  status: MatchStatus;
  /** Live match clock as reported by the provider ("67'", "HT"). */
  clock: string | null;
  minute: number | null;
  period: string | null;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  venue: string | null;
  hasLiveStream: boolean;
  /** Aggregated/most relevant market chips for list rendering (server-computed). */
  topMarkets?: MarketSummary[];
  isFavorite?: boolean;
  /** Freshness of the odds snapshot backing this row (drives the stale badge). */
  oddsUpdatedAt?: string | null;
  isStale?: boolean;
}

export interface MatchListItem extends Match {
  homeTeam: Pick<Team, 'id' | 'name' | 'nameFa' | 'logo' | 'shortName'>;
  awayTeam: Pick<Team, 'id' | 'name' | 'nameFa' | 'logo' | 'shortName'>;
  league: Pick<League, 'id' | 'name' | 'nameFa' | 'slug'>;
  sport: Pick<Sport, 'id' | 'slug' | 'nameEn' | 'nameFa'>;
}

export interface MatchEvent {
  id: Uuid;
  matchId: Uuid;
  providerEventId: string | null;
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'penalty_missed' | 'yellow_card' | 'red_card'
      | 'second_yellow' | 'substitution' | 'corner' | 'var' | 'kickoff' | 'halftime'
      | 'fulltime' | 'other';
  minute: number | null;
  period: string | null;
  teamId: Uuid | null;
  playerName: string | null;
  detail: string | null;
  occurredAt: string;
}

/* ------------------------------------------------------------------ */
/* Markets / selections / odds                                        */
/* ------------------------------------------------------------------ */

export type MarketStatus = 'open' | 'suspended' | 'closed' | 'settled' | 'void' | 'manual_review';
export type SelectionStatus = 'open' | 'suspended' | 'closed' | 'settled' | 'void';
export type MarketType =
  | '1X2' | 'DOUBLE_CHANCE' | 'DRAW_NO_BET' | 'OVER_UNDER' | 'BTTS' | 'HANDICAP'
  | 'ASIAN_HANDICAP' | 'CORRECT_SCORE' | 'HALF_TIME' | 'HT_FT' | 'TOTAL_CORNERS'
  | 'TOTAL_CARDS' | 'TEAM_TOTAL_GOALS' | 'PLAYER_MARKET' | 'OTHER';

export interface Selection {
  id: Uuid;
  marketId: Uuid;
  matchId: Uuid;
  /** Stable code within the market: 'HOME', 'DRAW', 'AWAY', 'OVER_2_5', 'YES', ... */
  code: string;
  name: string;
  nameFa: string | null;
  /** Line/parameter as an exact string ("2.5", "-1", "+1.5"). Never a float authority. */
  line: string | null;
  participantType: 'HOME' | 'AWAY' | 'DRAW' | 'NEUTRAL' | 'PLAYER' | 'OTHER';
  status: SelectionStatus;
  odds: OddsScaled;
  previousOdds: OddsScaled | null;
  oddsVersion: number;
  oddsUpdatedAt: string | null;
  provider: string | null;
  providerTimestamp: string | null;
  isStale: boolean;
}

export interface Market {
  id: Uuid;
  matchId: Uuid;
  type: MarketType;
  /** Provider-agnostic key, e.g. "1X2", "OU_FULL_TIME_2_5". */
  key: string;
  name: string;
  nameFa: string | null;
  status: MarketStatus;
  /** Odd/even, halves, period scoping. */
  specifier: string | null;
  period: string | null;
  /** 0 = primary/first-half-independent; used for ordering. */
  displayOrder: number;
  isLive: boolean;
  updatedAt: string;
  selections: Selection[];
}

export interface MarketSummary {
  marketId: Uuid;
  key: string;
  name: string;
  status: MarketStatus;
  selectionIds: Uuid[];
  odds: OddsScaled[];
}

export interface OddsRecord {
  selectionId: Uuid;
  provider: string;
  odds: OddsScaled;
  previousOdds: OddsScaled | null;
  oddsVersion: number;
  providerTimestamp: Date;
  ingestedAt: Date;
  isLive: boolean;
  status: SelectionStatus;
}

/* ------------------------------------------------------------------ */
/* Betting                                                            */
/* ------------------------------------------------------------------ */

export type BetType = 'SINGLE' | 'MULTIPLE';
export type BetStatus =
  | 'pending' | 'accepted' | 'cashed_out' | 'settled' | 'partially_settled'
  | 'void' | 'cancelled' | 'refunded' | 'manual_review' | 'rejected';

export type BetLegStatus =
  | 'pending' | 'won' | 'lost' | 'void' | 'half_won' | 'half_lost'
  | 'pending_review' | 'refunded' | 'settled_other';

export interface BetLeg {
  id: Uuid;
  betId: Uuid;
  matchId: Uuid;
  marketId: Uuid;
  selectionId: Uuid;
  /** Authoritative odds captured at placement (never client-supplied). */
  oddsAtPlacement: OddsScaled;
  /** Odds the user accepted after an odds-change prompt (may equal oddsAtPlacement). */
  acceptedOdds: OddsScaled;
  status: BetLegStatus;
  /** Raw grading facts, for audit + regrade. */
  settledAt: string | null;
  scoreSnapshot: string | null;
  voidReason: string | null;
  selectionName: string;
  marketName: string;
  matchLabel: string;
}

export interface Bet {
  id: Uuid;
  publicId: PublicId;
  userId: Uuid;
  type: BetType;
  /** Per-leg stake for MULTIPLE (equal split) - the stake is not multiplied. */
  stake: Money;
  /**
   * TOTAL RETURN if the bet wins: stake * combined odds (stake included).
   * On settlement a win credits exactly this amount; a loss credits nothing;
   * a void refunds `stake`.
   */
  potentialPayout: Money;
  /** stake * product(odds) for MULTIPLE; stake * odds for SINGLE. */
  combinedOddsNum: string;
  combinedOddsDen: string;
  combinedOddsScaled: OddsScaled;
  status: BetStatus;
  currency: string;
  placementIdempotencyKey: string;
  campaign: string | null;
  device: string | null;
  affiliateId: Uuid | null;
  /** Marker used by the settlement engine to refuse double processing. */
  settlementAttempts: number;
  placedAt: string;
  settledAt: string | null;
  payout: Money | null;
  legs: BetLeg[];
  /** Immutable snapshot of what the user was shown at placement (audit). */
  requestedSnapshot: unknown;
}

export type BetSlipMode = 'SINGLE' | 'MULTIPLE' | 'SYSTEM';

export interface BetSlipSelectionRequest {
  matchId: Uuid;
  marketId: Uuid;
  selectionId: Uuid;
  /** Odds the client believes are current - ONLY used to detect changes. */
  oddsSeen: OddsScaled;
  oddsVersionSeen: number;
}

export interface PlaceBetRequest {
  idempotencyKey: string;
  mode: BetSlipMode;
  /** Total stake for MULTIPLE, per-selection stake for SINGLE. */
  stake: Money;
  selections: BetSlipSelectionRequest[];
  /** True only when the user explicitly accepted the new odds shown to them. */
  acceptOddsChange: boolean;
  /** Optional client metadata; never trusted for money/identity decisions. */
  device?: string | null;
  campaign?: string | null;
}

export interface PlaceBetResult {
  ok: boolean;
  bet: Bet;
  /** Populated when placement succeeded only after the user accepted new odds. */
  oddsAdjustments: OddsAdjustment[];
  walletBalance: Money;
  idempotentReplay: boolean;
}

export interface OddsAdjustment {
  selectionId: Uuid;
  previousOdds: OddsScaled;
  currentOdds: OddsScaled;
  direction: 'INCREASED' | 'DECREASED';
}

export interface OddsChangeReport {
  kind: 'ODDS_CHANGED' | 'SELECTION_SUSPENDED' | 'MARKET_SUSPENDED' | 'MARKET_CLOSED' | 'MATCH_FINISHED'
      | 'MATCH_POSTPONED' | 'STALE_ODDS' | 'SELECTION_REMOVED';
  selectionId: Uuid;
  matchId: Uuid;
  marketId: Uuid;
  label: string;
  previousOdds: OddsScaled | null;
  currentOdds: OddsScaled | null;
  direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | null;
  message: string;
}

export interface BetQuoteLeg {
  selectionId: Uuid;
  oddsCurrent: OddsScaled;
  oddsSeen: OddsScaled;
  combinedOddsScaled: OddsScaled;
  potentialPayout: Money;
}

export interface BetQuote {
  ok: boolean;
  mode: BetSlipMode;
  currency: string;
  stake: Money;
  combinedOddsScaled: OddsScaled;
  potentialPayout: Money;
  legs: BetQuoteLeg[];
  changes: OddsChangeReport[];
  /** Server verdict: placement will be rejected unless acceptOddsChange=true. */
  requiresAcceptance: boolean;
  blocked: boolean;
  blockReasons: string[];
  validUntil: string;
}

/* ------------------------------------------------------------------ */
/* Wallet                                                             */
/* ------------------------------------------------------------------ */

export type WalletTransactionType =
  | 'deposit' | 'withdrawal' | 'bet_debit' | 'bet_refund' | 'win_credit'
  | 'void_refund' | 'bonus' | 'adjustment' | 'reversal' | 'withdrawal_hold'
  | 'withdrawal_release' | 'affiliate_payout';

export const CREDIT_TYPES: readonly WalletTransactionType[] =
  ['deposit', 'bet_refund', 'win_credit', 'void_refund', 'bonus', 'reversal', 'withdrawal_release'];
export const DEBIT_TYPES: readonly WalletTransactionType[] =
  ['withdrawal', 'bet_debit', 'adjustment', 'withdrawal_hold', 'affiliate_payout'];

export type WalletTransactionStatus = 'pending' | 'posted' | 'reversed' | 'failed' | 'cancelled';

export interface WalletTransaction {
  id: Uuid;
  walletId: Uuid;
  userId: Uuid;
  type: WalletTransactionType;
  /** Signed minor units: credits positive, debits negative. */
  amount: Money;
  /** Running balance after this entry (immutable snapshot for audit). */
  balanceAfter: Money;
  status: WalletTransactionStatus;
  reference: string | null;
  betId: Uuid | null;
  paymentTransactionId: Uuid | null;
  reversalOf: Uuid | null;
  idempotencyKey: string;
  reason: string | null;
  actorId: Uuid | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Wallet {
  id: Uuid;
  userId: Uuid;
  currency: string;
  /** Authoritative balance = SUM(wallet_transactions.amount) for posted rows. */
  balance: Money;
  locked: Money;
  available: Money;
  version: number;
  updatedAt: string;
}

export interface LedgerEntryRequest {
  userId: Uuid;
  type: WalletTransactionType;
  amount: Money;
  idempotencyKey: string;
  reference?: string | null;
  betId?: Uuid | null;
  paymentTransactionId?: Uuid | null;
  reversalOf?: Uuid | null;
  reason?: string | null;
  actorId?: Uuid | null;
  metadata?: Record<string, unknown>;
  /** Reject the entry if it would push the balance below this value (0 for "no negative"). */
  balanceFloor?: bigint | null;
  correlationId?: string;
}

export interface LedgerEntryResult {
  transaction: WalletTransaction;
  balanceAfter: Money;
  idempotentReplay: boolean;
}

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */

export type PaymentTransactionType = 'deposit' | 'withdrawal';
export type PaymentTransactionStatus =
  | 'initiated' | 'pending' | 'requires_action' | 'succeeded' | 'failed'
  | 'cancelled' | 'expired' | 'refunded' | 'reversed';

export interface PaymentIntent {
  transactionId: Uuid;
  provider: string;
  providerReference: string | null;
  status: PaymentTransactionStatus;
  amount: Money;
  /** Where to send the user for hosted checkout; null for manual review flows. */
  redirectUrl: string | null;
  expiresAt: string | null;
}

/** Normalised, signature-verified provider callback. */
export interface PaymentCallback {
  provider: string;
  providerEventId: string;
  type: PaymentTransactionType;
  providerReference: string;
  status: PaymentTransactionStatus;
  amount: Money;
  userId: Uuid | null;
  occurredAt: Date;
  raw: unknown;
}

/* ------------------------------------------------------------------ */
/* Settlement                                                         */
/* ------------------------------------------------------------------ */

export type SettlementJobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'manual_review' | 'skipped';

export interface SettlementJob {
  id: Uuid;
  betId: Uuid;
  userId: Uuid;
  status: SettlementJobStatus;
  attempts: number;
  reason: string | null;
  createdAt: string;
  processedAt: string | null;
}

export type LegGrade = 'WON' | 'LOST' | 'VOID' | 'HALF_WON' | 'HALF_LOST' | 'PENDING' | 'MANUAL_REVIEW';

export interface GradedLeg {
  selectionId: Uuid;
  grade: LegGrade;
  reason: string;
  /** True when the grade came from an authoritative provider result rather than an operator. */
  authoritative: boolean;
}

export type MatchResultStatus = 'finished' | 'cancelled' | 'abandoned' | 'postponed' | 'interrupted' | 'corrected';

export interface MatchResult {
  matchId: Uuid;
  status: MatchResultStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeHalfScore: number | null;
  awayHalfScore: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  homeCards: number | null;
  awayCards: number | null;
  /** Match went to extra time / penalties; per-market rules decide what counts. */
  extraTime: boolean;
  penalties: boolean;
  penaltyHome: number | null;
  penaltyAway: number | null;
  provider: string;
  providerResultId: string | null;
  authoritative: boolean;
  observedAt: Date;
  revision: number;
}

export interface SettlementOutcome {
  betId: Uuid;
  status: BetStatus;
  payout: Money;
  gradedLegs: GradedLeg[];
  /** Wallet transaction created (null when the bet lost and nothing is credited). */
  ledgerTransactionId: Uuid | null;
  idempotentReplay: boolean;
  manualReviewReason: string | null;
}

/* ------------------------------------------------------------------ */
/* Risk                                                               */
/* ------------------------------------------------------------------ */

export type RiskDecisionType = 'ALLOW' | 'LIMIT' | 'REJECT' | 'MANUAL_REVIEW';

export interface RiskDecision {
  decision: RiskDecisionType;
  /** Populated for LIMIT: the maximum stake the engine will accept. */
  maxStakeAllowed: Money | null;
  /** Machine-readable reasons, always logged. */
  reasons: string[];
  ruleIds: Uuid[];
  /** True when a human must confirm before the bet is accepted. */
  requiresManualReview: boolean;
}

export interface RiskRule {
  id: Uuid;
  scope: 'global' | 'sport' | 'league' | 'match' | 'market' | 'user' | 'affiliate';
  scopeRef: string | null;
  kind: 'min_stake' | 'max_stake' | 'max_payout' | 'max_exposure' | 'max_daily_stake'
      | 'max_daily_payout' | 'max_live_stake' | 'account_restriction' | 'velocity';
  value: string;
  currency: string | null;
  isLive: boolean | null;
  action: 'LIMIT' | 'REJECT' | 'MANUAL_REVIEW';
  priority: number;
  isActive: boolean;
  reason: string | null;
}

/* ------------------------------------------------------------------ */
/* Affiliate                                                          */
/* ------------------------------------------------------------------ */

export type CommissionModel = 'PROFIT_LOSS_35' | 'NON_NEGATIVE_35' | 'CPA' | 'HYBRID';
export type AffiliateStatus = 'pending' | 'approved' | 'suspended' | 'blocked' | 'closed';

export interface Affiliate {
  id: Uuid;
  userId: Uuid;
  publicId: PublicId;
  code: string;
  slug: string;
  displayName: string | null;
  status: AffiliateStatus;
  commissionModel: CommissionModel;
  commissionRateBps: number;
  allowNegativeBalance: boolean;
  negativeBalanceFloor: bigint;
  minPayout: Money;
  maxPayout: Money | null;
  parentAffiliateId: Uuid | null;
  depth: number;
  parentOverrideBps: number;
  netBpsCapBps: number | null;
  settlementDayIso: number;
  settlementHour: number;
  settlementMinute: number;
  settlementTimezone: string;
  autoPayoutEnabled: boolean;
  createdAt: string;
  approvedAt: string | null;
}

export type AffiliateLedgerType =
  | 'user_loss_commission' | 'user_win_debit' | 'reversal' | 'adjustment'
  | 'settlement' | 'payout' | 'carry_forward' | 'carry_forward_release';

export type AffiliateLedgerDirection = 'credit' | 'debit';

export interface AffiliateLedgerEntry {
  id: Uuid;
  affiliateId: Uuid;
  type: AffiliateLedgerType;
  /** Signed minor units in the affiliate's payout currency. */
  amount: bigint;
  currency: string;
  direction: AffiliateLedgerDirection;
  commissionRateBps: number;
  /** The authoritative betting amount the entry derives from (user win/loss). */
  sourceAmount: bigint;
  sourceKind: 'bet_settlement' | 'bet_regrade' | 'manual' | 'settlement' | 'payout' | 'system';
  userId: Uuid | null;
  betId: Uuid | null;
  betSettlementId: Uuid | null;
  settlementId: Uuid | null;
  payoutId: Uuid | null;
  /** Commission basis points actually applied (may be prorated by the cap). */
  appliedRateBps: number;
  capApplied: boolean;
  status: 'pending' | 'available' | 'settled' | 'paid' | 'void';
  idempotencyKey: string;
  createdAt: string;
  settledAt: string | null;
  metadata: Record<string, unknown>;
}

export interface AffiliateCommissionConfig {
  id: Uuid;
  scope: 'GLOBAL' | 'SPORT' | 'GROUP' | 'AFFILIATE' | 'CAMPAIGN';
  scopeRef: string | null;
  commissionModel: CommissionModel;
  commissionRateBps: number;
  allowNegativeBalance: boolean;
  negativeBalanceFloor: bigint;
  minPayoutMinor: bigint;
  maxPayoutMinor: bigint | null;
  parentOverrideBps: number;
  netCapBps: number | null;
  carryForward: boolean;
  settlementDayIso: number;
  settlementTime: string;
  settlementTimezone: string;
  autoPayout: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  priority: number;
  isActive: boolean;
  reason: string | null;
  createdBy: Uuid | null;
  createdAt: string;
}

export type AffiliateSettlementStatus =
  | 'draft' | 'locked' | 'processing' | 'calculated' | 'paid' | 'partially_paid'
  | 'skipped' | 'failed' | 'manual_review';

export interface AffiliateSettlement {
  id: Uuid;
  affiliateId: Uuid;
  periodStart: string;
  periodEnd: string;
  status: AffiliateSettlementStatus;
  closedEntriesCount: number;
  grossCommissionMinor: bigint;
  negativeImpactMinor: bigint;
  netMinor: bigint;
  openingCarryMinor: bigint;
  closingCarryMinor: bigint;
  payableMinor: bigint;
  currency: string;
  commissionModel: CommissionModel;
  commissionRateBps: number;
  minimumPayoutMinor: bigint;
  payoutId: Uuid | null;
  weekKey: string;
  settledAt: string | null;
  calculatedAt: string | null;
  createdAt: string;
  notes: string | null;
}

export type AffiliatePayoutStatus =
  | 'pending' | 'eligible' | 'approved' | 'processing' | 'paid'
  | 'failed' | 'cancelled' | 'manual_review' | 'rejected';

export interface AffiliatePayout {
  id: Uuid;
  publicId: PublicId;
  affiliateId: Uuid;
  settlementId: Uuid | null;
  amountMinor: bigint;
  currency: string;
  status: AffiliatePayoutStatus;
  method: string | null;
  destinationMasked: string | null;
  provider: string | null;
  providerReference: string | null;
  requestedAt: string;
  approvedBy: Uuid | null;
  approvedAt: string | null;
  paidAt: string | null;
  failedReason: string | null;
  idempotencyKey: string;
  dualApprovalRequired: boolean;
  secondApproverId: Uuid | null;
  notes: string | null;
}

export interface ReferralCode {
  affiliateId: Uuid;
  code: string;
  slug: string;
}

export interface AffiliateLink {
  id: Uuid;
  affiliateId: Uuid;
  code: string;
  campaign: string;
  source: string | null;
  medium: string | null;
  landingPath: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  clicks: number;
  registrations: number;
  firstDeposits: number;
  turnoverMinor: bigint;
  commissionMinor: bigint;
}

export interface AffiliateClick {
  id: Uuid;
  affiliateId: Uuid;
  linkId: Uuid | null;
  code: string;
  campaign: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  deviceFingerprint: string | null;
  referrer: string | null;
  landingPath: string;
  /** Auxiliary signals only; attribution decisions are server-authoritative. */
  isLikelyBot: boolean;
  createdAt: string;
}

export type AttributionStatus = 'pending' | 'confirmed' | 'rejected' | 'locked' | 'review';

export interface AffiliateAttribution {
  id: Uuid;
  affiliateId: Uuid;
  linkId: Uuid | null;
  userId: Uuid;
  code: string;
  campaign: string | null;
  status: AttributionStatus;
  /** Attributes the click that produced this attribution. */
  clickId: Uuid | null;
  ipHash: string | null;
  deviceFingerprint: string | null;
  confirmedAt: string | null;
  lockedAt: string | null;
  /** Immutable once confirmed: only an authorized admin action may change it (audited). */
  isImmutable: boolean;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AffiliateRelationship {
  id: Uuid;
  affiliateId: Uuid;
  parentAffiliateId: Uuid;
  depth: number;
  path: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: Uuid | null;
  reason: string | null;
}

export interface ReferredUserStats {
  affiliateId: Uuid;
  totalReferred: number;
  active: number;
  firstDeposits: number;
  totalTurnoverMinor: bigint;
  settledBets: number;
  userWinsMinor: bigint;
  userLossesMinor: bigint;
  pendingCommissionMinor: bigint;
  currency: string;
}

export interface AffiliateDashboard {
  affiliate: Affiliate;
  currency: string;
  payableBalanceMinor: bigint;
  openingCarryMinor: bigint;
  pendingCommissionMinor: bigint;
  totalEarnedMinor: bigint;
  totalPaidMinor: bigint;
  totalNegativeImpactMinor: bigint;
  floorZeroApplied: boolean;
  nextSettlementAt: string;
  estimatedPayoutMinor: bigint;
  minimumPayoutMinor: bigint;
  stats: ReferredUserStats;
  daily: { day: string; commissionMinor: bigint; turnoverMinor: bigint; registrations: number }[];
  weekly: { week: string; commissionMinor: bigint; netMinor: bigint }[];
}

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

export type NotificationType =
  | 'bet_accepted' | 'bet_won' | 'bet_lost' | 'bet_void' | 'bet_cashout'
  | 'odds_change' | 'deposit' | 'withdrawal' | 'security_alert'
  | 'affiliate_commission' | 'affiliate_settlement' | 'affiliate_payout'
  | 'system' | 'promotion';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped_disabled' | 'not_applicable';

export interface Notification {
  id: Uuid;
  userId: Uuid;
  type: NotificationType;
  title: string;
  body: string;
  /** Internal route to open; never an external URL. */
  linkPath: string | null;
  data: Record<string, unknown>;
  channel: NotificationChannel;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDelivery {
  id: Uuid;
  notificationId: Uuid;
  channel: NotificationChannel;
  provider: string;
  status: DeliveryStatus;
  attempts: number;
  error: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Operations                                                         */
/* ------------------------------------------------------------------ */

export interface FeatureFlags {
  liveBetting: boolean;
  cashout: boolean;
  betBuilder: boolean;
  bonus: boolean;
  affiliatePayouts: boolean;
  payments: boolean;
  kyc: boolean;
  streaming: boolean;
  multiCurrency: boolean;
  [key: string]: boolean;
}

export interface EmergencyControls {
  BETTING_OFF: boolean;
  LIVE_BETTING_OFF: boolean;
  PREMATCH_BETTING_OFF: boolean;
  DEPOSITS_OFF: boolean;
  WITHDRAWALS_OFF: boolean;
  ODDS_INGESTION_OFF: boolean;
  SETTLEMENT_OFF: boolean;
  AFFILIATE_PAYOUT_OFF: boolean;
  MAINTENANCE_MODE: boolean;
}

export type OperationKey = keyof EmergencyControls;

export interface ProviderHealth {
  provider: string;
  kind: 'sports' | 'payment' | 'notification';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled' | 'unknown';
  /** Freshness of the last successful provider interaction, in seconds. */
  lastSuccessAgoSeconds: number | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  latencyMs: number | null;
  checkedAt: string;
}

export interface WorkerRun {
  id: Uuid;
  worker: string;
  jobKey: string;
  status: 'running' | 'succeeded' | 'failed' | 'skipped' | 'dead_letter';
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  itemsProcessed: number;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditEventInput {
  actorId: Uuid | null;
  actorRole: UserRole | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  correlationId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
}

export type ReconciliationStatus = 'ok' | 'mismatch' | 'manual_review' | 'resolved';

export interface ReconciliationRecord {
  id: Uuid;
  periodStart: string;
  periodEnd: string;
  checkKey: string;
  expectedMinor: bigint;
  actualMinor: bigint;
  differenceMinor: bigint;
  status: ReconciliationStatus;
  details: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: Uuid | null;
  resolutionNote: string | null;
}

export interface SearchResult {
  kind: 'sport' | 'country' | 'league' | 'team' | 'match';
  id: Uuid;
  label: string;
  sublabel: string | null;
  href: string;
  score: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CursorPaginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
