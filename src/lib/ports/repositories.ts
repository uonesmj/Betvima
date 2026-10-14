import type {
  AdminAdjustmentRequest, AdminUserSummary, Affiliate, AffiliateLedgerEntry, AffiliatePayout, AffiliateStats,
  AttributionRecord, AuditLogEntry, Bet, BetFilter, CashoutQuote, CommissionModel, Currency, DashboardMetrics,
  DepositLimitsCheck, FraudSignalResult, ISODateString, Job, KillSwitchState, League, Market, Match, MatchResultSnapshot,
  Paginated, PaymentIntent, PaymentMethod, ProviderHealth, ReconciliationReport, RiskRule, Sport, SystemSetting,
  UserProfile, UUID, Wallet, WalletEntry, WalletStatement, WorkerHeartbeat,
  BonusGrant, BonusListResult,
} from '@/lib/types';
import type { ActorContext, Db } from './db';

export interface Repository { readonly db: Db }

/** Re-exported so adapters and services share one definition of each filter shape. */
export type { BetFilter } from '@/lib/types';

/** ------------------------------------------------------------------ catalogue */
export interface CatalogRepository extends Repository {
  listSports(c: ActorContext, filter?: { from?: ISODateString; to?: ISODateString }): Promise<(Sport & { matchCount?: number })[]>;
  listCountries(c: ActorContext): Promise<{ code: string; nameEn: string; nameFa: string; flag: string | null }[]>;
  listLeagues(c: ActorContext, filter: { sportKey?: string; countryCode?: string; search?: string; leagueId?: UUID; limit?: number }): Promise<League[]>;
  listMatches(c: ActorContext, filter: MatchFilter): Promise<Paginated<Match>>;
  getMatch(c: ActorContext, matchId: UUID): Promise<Match | null>;
  getMatchBySlugOrId(c: ActorContext, key: string): Promise<Match | null>;
  listMarkets(c: ActorContext, matchId: UUID, filter?: { isLive?: boolean; includeSuspended?: boolean }): Promise<Market[]>;
  getMarket(c: ActorContext, marketId: UUID): Promise<Market | null>;
  /** Authoritative pricing inputs: current odds + version + status for the requested selections. */
  getSelectionsForPlacement(matchId: UUID, selectionIds: UUID[]): Promise<SelectionSnapshot[]>;
  getResult(matchId: UUID): Promise<MatchResultSnapshot | null>;
  listMatchEvents(matchId: UUID): Promise<import('@/lib/types').MatchEventView[]>;
  getMatchStats(matchId: UUID): Promise<import('@/lib/types').MatchStatsView | null>;
  listLiveMatches(c: ActorContext, limit: number): Promise<Match[]>;
  listLiveSportCounts(c: ActorContext): Promise<Record<string, number>>;
  listUpcomingMatches(c: ActorContext, hours: number, limit: number): Promise<Match[]>;
  /** Upcoming non-esports events with fresh, open odds; excludes unpriced fixtures. */
  listTopBetMatches(c: ActorContext, hours: number, limit: number): Promise<Match[]>;
  search(c: ActorContext, query: string, limit: number): Promise<Match[]>;
}
export interface MatchFilter {
  sportKey?: string; leagueId?: UUID; status?: string[]; from?: ISODateString; to?: ISODateString;
  live?: boolean; featured?: boolean; search?: string; page?: number; pageSize?: number; includeTotal?: boolean;
  sortBy?: 'scheduled_at' | 'priority' | 'popularity'; sortDirection?: 'asc' | 'desc';
}
export interface SelectionSnapshot {
  selectionId: UUID; marketId: UUID; matchId: UUID; marketKey: string; marketStatus: string;
  selectionStatus: string; oddsScaled: bigint; oddsVersion: number; line: string | null;
  matchStatus: string; scheduledAt: ISODateString; isLive: boolean; maxStakeMinor: bigint | null;
  oddsUpdatedAt: ISODateString | null;
  selectionName: string; marketName: string; matchLabel: string;
}

/** ---------------------------------------------------------------------- betting */
export interface BettingRepository extends Repository {
  placeBet(input: PlaceBetInput): Promise<PlaceBetResult>;
  listBets(c: ActorContext, filter: BetFilter & { userId?: UUID }): Promise<Paginated<Bet>>;
  getBet(c: ActorContext, betId: UUID, userId?: UUID | null): Promise<Bet | null>;
  getBetByPublicId(c: ActorContext, publicId: string): Promise<Bet | null>;
  getCashoutQuote(c: ActorContext, betId: UUID, userId: UUID): Promise<CashoutQuote>;
  acceptCashout(c: ActorContext, input: { betId: UUID; quoteId: UUID; userId: UUID; idempotencyKey: string }): Promise<{ betId: UUID; offerMinor: bigint; balanceAfterMinor: bigint; replay: boolean }>;
  cancelBet(c: ActorContext, betId: UUID, userId: UUID, reason?: string): Promise<Bet>;
  settleBet(input: SettleBetInput): Promise<SettleBetResult>;
  reverseSettlement(input: ReverseSettlementInput): Promise<ReverseSettlementResult>;
  manualSettle(input: ManualSettleInput): Promise<{ bet: Bet; balanceAfterMinor?: bigint | null }>;
  listSettlementCandidates(limit: number): Promise<{ betId: UUID; matchId: UUID; legIds: UUID[] }[]>;
  listOpenBetsForMatch(matchId: UUID): Promise<Bet[]>;
  dailyStakeForUser(userId: UUID, currency: Currency, dayKey: string): Promise<bigint>;
  openBetCount(userId: UUID): Promise<number>;
  exposureForUser(userId: UUID, currency: Currency): Promise<bigint>;
}
export interface PlaceBetInput {
  actor: ActorContext; userId: UUID; idempotencyKey: string;
  payload: {
    type: 'SINGLE' | 'MULTIPLE' | 'SYSTEM'; stakeMinor: string; currency: Currency;
    fundingSource?: 'main' | 'bonus'; bonusGrantId?: UUID | null;
    legs: { selectionId: UUID; marketId: UUID; matchId: UUID; clientOddsScaled: string | null; marketVersion: number | null; acceptOddsChange: boolean }[];
    systemSelections?: number[]; source?: string; acceptWarnings?: boolean;
  };
}
export interface PlaceBetResult {
  status: 'accepted' | 'idempotent_replay'; bet: Bet; balanceAfterMinor: bigint;
  quote: { combinedOddsScaled: bigint; potentialPayoutMinor: bigint; warnings: string[] };
}
export interface SettleBetInput {
  betId: UUID; revision: number; source: 'provider' | 'manual' | 'regrade' | 'system';
  legs: { selectionId: UUID; grade: 'WON' | 'LOST' | 'VOID' | 'HALF_WON' | 'HALF_LOST' | 'MANUAL_REVIEW' }[];
  /**
   * Payout computed by the settlement engine from AUTHORITATIVE placement odds
   * (`computeBetPayout`). Required: the database refuses to invent a payout.
   */
  payoutMinor: string;
  actorId?: UUID | null; note?: string | null; idempotencyKey: string;
}
export interface SettleBetResult {
  settlementId: UUID; status: 'settled' | 'void' | 'partially_settled' | 'manual_review' | 'idempotent_replay';
  payoutMinor: bigint; netUserResultMinor: bigint; balanceAfterMinor: bigint | null; betRevision: number;
}
export interface ReverseSettlementInput { betId: UUID; settlementId: UUID; reason: string; actorId: UUID; idempotencyKey: string }
export interface ReverseSettlementResult { betId: UUID; reversedSettlementId: UUID; reversalEntryId: UUID | null; affiliateReversals: number }
export interface ManualSettleInput {
  betId: UUID; decision: 'WIN' | 'LOSS' | 'VOID'; reason: string; actorId: UUID; idempotencyKey: string; notes?: string;
}

/** ------------------------------------------------------------------ wallet */
export interface BonusRepository extends Repository {
  listGrants(userId: UUID, filter: {
    currency?: Currency;
    status?: BonusGrant['status'];
    page?: number;
    pageSize?: number;
  }): Promise<BonusListResult>;
}

export interface WalletRepository extends Repository {
  postEntry(input: PostWalletEntryInput): Promise<PostWalletEntryResult>;
  getWallet(c: ActorContext, userId: UUID, currency: Currency): Promise<Wallet | null>;
  ensureWallet(userId: UUID, currency: Currency): Promise<Wallet>;
  listEntries(c: ActorContext, userId: UUID, filter: { currency?: Currency; type?: string; from?: ISODateString; to?: ISODateString; page?: number; pageSize?: number }): Promise<WalletStatement>;
  adminAdjust(input: AdminAdjustmentInput): Promise<AdminAdjustmentRequest>;
  requestAdminAdjustment(input: AdminAdjustmentInput): Promise<AdminAdjustmentRequest>;
  approveAdminAdjustment(input: { requestId: UUID; actorId: UUID; approve: boolean; reason?: string }): Promise<AdminAdjustmentRequest>;
  listAdminAdjustments(filter: { status?: string; page?: number; pageSize?: number }): Promise<Paginated<AdminAdjustmentRequest>>;
  checkDepositLimits(userId: UUID, currency: Currency, amountMinor: bigint): Promise<DepositLimitsCheck>;
}
export interface PostWalletEntryInput {
  userId: UUID; currency: Currency; type: string; direction: 'credit' | 'debit'; amountMinor: string;
  idempotencyKey: string; referenceType?: string | null; referenceId?: string | null;
  betId?: UUID | null; paymentId?: UUID | null; description?: string | null;
  metadata?: Record<string, unknown> | null; createdBy?: UUID | null; actor?: ActorContext;
}
export interface PostWalletEntryResult { entryId: UUID; walletId: UUID; balanceAfterMinor: bigint; idempotentReplay: boolean }
export interface AdminAdjustmentInput { userId: UUID; currency: Currency; amountMinor: string; direction: 'credit' | 'debit'; type: string; reason: string; actorId: UUID; idempotencyKey: string; notes?: string }

/** -------------------------------------------------------------------- users */
export interface UserRepository extends Repository {
  getProfile(userId: UUID): Promise<UserProfile | null>;
  getProfileByEmail(email: string): Promise<UserProfile | null>;
  updateProfile(userId: UUID, patch: Partial<UserProfile> & { limits?: Partial<UserProfile['limits']> }): Promise<UserProfile>;
  setStatus(input: { userId: UUID; status: string; reason: string; actorId: UUID; until?: ISODateString | null }): Promise<UserProfile>;
  listForAdmin(filter: AdminUserFilter): Promise<Paginated<AdminUserSummary>>;
  getAdminSummary(userId: UUID): Promise<AdminUserSummary | null>;
  setKyc(input: { userId: UUID; status: string; actorId: UUID; note?: string }): Promise<UserProfile>;
  addNote(input: { userId: UUID; actorId: UUID; note: string; isInternal: boolean }): Promise<{ id: UUID }>;
  listNotes(userId: UUID): Promise<{ id: UUID; note: string; actorId: UUID | null; createdAt: ISODateString; isInternal: boolean }[]>;
  setRole(input: { userId: UUID; role: string; actorId: UUID; reason: string }): Promise<UserProfile>;
  getLimits(userId: UUID): Promise<UserProfile['limits']>;
  updateLimits(input: { userId: UUID; limits: Partial<UserProfile['limits']>; actorId: UUID }): Promise<UserProfile['limits']>;
  sessionLimits(userId: UUID): Promise<{ lossLimitDailyMinor: bigint | null; lossLimitWeeklyMinor: bigint | null }>;
}
export interface AdminUserFilter {
  search?: string; status?: string; role?: string; kycStatus?: string; affiliateId?: UUID;
  from?: ISODateString; to?: ISODateString; page?: number; pageSize?: number; sortBy?: 'registered_at' | 'last_login_at' | 'net_result'; sortDirection?: 'asc' | 'desc';
}

/** ------------------------------------------------------------------ affiliate */
export type AffiliateWalletAsset = 'USDT_TRC20' | 'TRX' | 'DOGE';

export interface AffiliateWallet {
  id: UUID;
  affiliateId: UUID;
  asset: AffiliateWalletAsset;
  address: string;
  addressMasked: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AffiliateRepository extends Repository {
  getByCode(code: string): Promise<Affiliate | null>;
  getById(id: UUID): Promise<Affiliate | null>;
  getByUserId(userId: UUID): Promise<Affiliate | null>;
  register(input: AffiliateRegistration): Promise<Affiliate>;
  update(input: { affiliateId: UUID; patch: Partial<Affiliate>; actorId: UUID }): Promise<Affiliate>;
  setStatus(input: { affiliateId: UUID; status: string; actorId: UUID; reason: string }): Promise<Affiliate>;
  setParent(input: { affiliateId: UUID; parentAffiliateId: UUID | null; actorId: UUID }): Promise<Affiliate>;
  listForAdmin(filter: AffiliateFilter): Promise<Paginated<Affiliate>>;
  listLedger(affiliateId: UUID, filter: { from?: ISODateString; to?: ISODateString; type?: string; page?: number; pageSize?: number }): Promise<Paginated<AffiliateLedgerEntry>>;
  getStats(affiliateId: UUID, period: { start: ISODateString; end: ISODateString }): Promise<AffiliateStats>;
  payableBalance(affiliateId: UUID): Promise<{ payableMinor: bigint; rawMinor: bigint; carryForwardMinor: bigint; suppressedMinor: bigint; floorApplied: boolean }>;
  recordClick(input: ReferralClickInput): Promise<{ clickId: UUID; affiliateId: UUID }>;
  attachAttribution(input: AttributionInput): Promise<{ attribution: AttributionRecord; created: boolean }>;
  getAttribution(userId: UUID): Promise<AttributionRecord | null>;
  replaceAttribution(input: { userId: UUID; affiliateId: UUID; code: string; actorId: UUID; reason: string }): Promise<AttributionRecord>;
  settlePeriod(input: { affiliateId: UUID; periodStart: ISODateString; periodEnd: ISODateString; dryRun?: boolean; actorId?: UUID | null }): Promise<AffiliateSettlementResult>;
  settleAllDue(input: { now: ISODateString; dryRun?: boolean }): Promise<AffiliateSettlementResult[]>;
  listWallets(affiliateId: UUID): Promise<AffiliateWallet[]>;
  upsertWallet(input: { affiliateId: UUID; asset: AffiliateWalletAsset; address: string }): Promise<AffiliateWallet>;
  requestPayout(input: { affiliateId: UUID; amountMinor: string; currency: Currency; method: string; payoutAsset: AffiliateWalletAsset; idempotencyKey: string }): Promise<AffiliatePayout>;
  transitionPayout(input: { payoutId: UUID; to: 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled' | 'failed'; actorId: UUID; reason?: string; providerReference?: string; evidenceUrl?: string }): Promise<AffiliatePayout>;
  listPayouts(filter: { affiliateId?: UUID; status?: string; page?: number; pageSize?: number; from?: ISODateString; to?: ISODateString }): Promise<Paginated<AffiliatePayout>>;
  getPayout(payoutId: UUID): Promise<AffiliatePayout | null>;
  adjust(input: { affiliateId: UUID; amountMinor: string; reason: string; actorId: UUID; idempotencyKey: string; kind?: 'adjustment' | 'fraud_hold' | 'fraud_release' }): Promise<{ ledgerEntryId: UUID; payableMinor: bigint }>;
  fraudSignals(affiliateId: UUID): Promise<FraudSignalResult>;
  listReferrals(affiliateId: UUID, filter: { page?: number; pageSize?: number }): Promise<Paginated<{ userId: UUID; code: string; status: string; confirmedAt: ISODateString | null; wageredMinor: bigint; netRevenueMinor: bigint; commissionMinor: bigint; depositMinor: bigint; withdrawalMinor: bigint; panelShareMinor: bigint }>>;
  listAdminReferralBuckets(affiliateId: UUID, filter: { page?: number; pageSize?: number }): Promise<Paginated<{ userId: UUID; code: string; status: string; confirmedAt: ISODateString | null; currency: Currency; wageredMinor: bigint; netRevenueMinor: bigint; commissionMinor: bigint; depositMinor: bigint; withdrawalMinor: bigint; panelShareMinor: bigint }>>;
  hierarchy(affiliateId: UUID): Promise<Affiliate[]>;
  // public stats endpoints
  publicStats(affiliateId: UUID, period: { start: ISODateString; end: ISODateString }): Promise<AffiliateStats>;
}
export interface AffiliateRegistration {
  userId: UUID; code: string; displayName: string; username?: string | null; email?: string | null; phone?: string | null; accountNumber?: string | null;
  parentCode?: string | null; model?: CommissionModel; rateBps?: number; actorId?: UUID | null;
}
export interface AffiliateFilter {
  search?: string; status?: string; parentAffiliateId?: UUID; model?: CommissionModel; flaggedOnly?: boolean;
  from?: ISODateString; to?: ISODateString; page?: number; pageSize?: number;
}
export interface ReferralClickInput {
  code: string; campaign?: string | null; landingUrl?: string | null; ipHash?: string | null;
  userAgentHash?: string | null; deviceFingerprint?: string | null; referer?: string | null; isBot?: boolean;
}
export interface AttributionInput {
  userId: UUID; code: string; clickId?: UUID | null; campaign?: string | null;
  ipHash?: string | null; deviceFingerprint?: string | null; actorId?: UUID | null;
}
export interface AffiliateSettlementResult {
  affiliateId: UUID; periodStart: ISODateString; periodEnd: ISODateString;
  status: 'settled' | 'duplicate' | 'skipped' | 'failed'; commissionMinor: bigint; payableMinor: bigint;
  carryForwardMinor: bigint; suppressedMinor: bigint; ledgerEntries: number; payoutCreated: boolean; message?: string;
}

/** ------------------------------------------------------------------- payments */
export type CryptoPayoutAttemptStatus =
  | 'prepared'
  | 'submitting'
  | 'provider_created'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'manual_review';

export interface CryptoPayoutAttempt {
  id: UUID;
  paymentTransactionId: UUID;
  status: CryptoPayoutAttemptStatus;
  provider: string;
  providerReference: string | null;
  attemptNo: number;
  destination: string | null;
  payoutCurrency: string | null;
  amountMinor: bigint;
  requestStartedAt: ISODateString | null;
  providerCreatedAt: ISODateString | null;
  lastCheckedAt: ISODateString | null;
  completedAt: ISODateString | null;
  manualReviewAt: ISODateString | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PrepareCryptoPayoutAttemptInput {
  publicId: string;
  destination: string;
  payoutCurrency: string;
  amountMinor: bigint;
  provider?: string;
}

export interface PaymentRepository extends Repository {
  listMethods(input: { direction?: 'deposit' | 'withdrawal'; currency?: Currency }): Promise<PaymentMethod[]>;
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  getIntent(input: { intentId?: UUID; publicId?: string; userId?: UUID }): Promise<PaymentIntent | null>;
  getIntentByProviderReference(input: { providerReference: string }): Promise<PaymentIntent | null>;
  updateIntentAmount(input: { publicId: string; amountMinor: string; providerMetadata?: Record<string, unknown> }): Promise<PaymentIntent>;
  listIntents(filter: { userId?: UUID; direction?: 'deposit' | 'withdrawal'; status?: string; from?: ISODateString; to?: ISODateString; page?: number; pageSize?: number }): Promise<Paginated<PaymentIntent>>;
  completeIntent(input: { publicId: string; status: 'succeeded' | 'failed' | 'pending' | 'cancelled'; providerReference?: string | null; failureCode?: string | null; failureMessage?: string | null; raw?: Record<string, unknown> }): Promise<{ intent: PaymentIntent; walletEntryId: UUID | null }>;
  recordWebhook(input: { provider: string; eventId: string; eventType: string; signatureValid: boolean; payload: Record<string, unknown>; raw: string; ip?: string | null }): Promise<{ receiptId: UUID; isDuplicate: boolean; processed: boolean }>;
  reviewWithdrawal(input: { publicId: string; decision: 'approve' | 'reject'; actorId: UUID; reason?: string }): Promise<PaymentIntent>;
  getCryptoPayoutAttempt(input: { publicId: string }): Promise<CryptoPayoutAttempt | null>;
  prepareCryptoPayoutAttempt(input: PrepareCryptoPayoutAttemptInput): Promise<CryptoPayoutAttempt>;
  claimCryptoPayoutAttempt(input: { publicId: string }): Promise<CryptoPayoutAttempt>;
  updateCryptoPayoutAttempt(input: {
    publicId: string;
    status: CryptoPayoutAttemptStatus;
    providerReference?: string | null;
    lastError?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<CryptoPayoutAttempt>;
  markPaid(input: { publicId: string; actorId: UUID; providerReference?: string; evidenceUrl?: string }): Promise<PaymentIntent>;
  refund(input: { intentId: UUID; amountMinor: string; reason: string; actorId: UUID; idempotencyKey: string }): Promise<{ refundIntent: PaymentIntent; walletEntryId: UUID }>;
  dailyDeposits(userId: UUID, currency: Currency, dayKey: string): Promise<bigint>;
  markWebhookProcessed(input: { receiptId: UUID; result: string }): Promise<void>;
}
export interface CreatePaymentIntentInput {
  userId: UUID; direction: 'deposit' | 'withdrawal'; currency: Currency; amountMinor: string;
  methodId: string; idempotencyKey: string; returnUrl?: string | null; destination?: Record<string, unknown> | null; providerMetadata?: Record<string, unknown> | null; actor?: ActorContext;
}

/** ---------------------------------------------------------------- notifications */
export type SupportTicketStatus =
  | 'open'
  | 'waiting_user'
  | 'waiting_support'
  | 'resolved'
  | 'closed';

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportTicketCategory =
  | 'deposit'
  | 'withdrawal'
  | 'bet'
  | 'login'
  | 'bonus'
  | 'technical'
  | 'other'
  | 'general';

export interface SupportTicket {
  id: UUID;
  userId: UUID;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedTo: UUID | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SupportAttachment {
  id: UUID;
  ticketId: UUID;
  messageId: UUID;
  uploaderId: UUID | null;
  uploaderRole: 'user' | 'support';
  bucketId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: ISODateString;
}

export interface SupportAttachmentInput {
  uploaderId: UUID;
  uploaderRole: 'user' | 'support';
  bucketId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SupportMessage {
  id: UUID;
  ticketId: UUID;
  senderId: UUID | null;
  senderRole: 'user' | 'support' | 'system';
  body: string;
  createdAt: ISODateString;
  attachments: SupportAttachment[];
}

export interface SupportTicketSummary extends SupportTicket {
  userEmail: string | null;
  userDisplayName: string | null;
  unreadMessages: number;
  lastMessageAt: ISODateString | null;
}

export interface SupportRepository extends Repository {
  listForUser(userId: UUID, filter?: {
    status?: SupportTicketStatus;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<SupportTicketSummary>>;
  getForUser(ticketId: UUID, userId: UUID): Promise<SupportTicket | null>;
  listMessages(ticketId: UUID, userId?: UUID): Promise<SupportMessage[]>;
  createTicket(input: {
    userId: UUID;
    subject: string;
    category: SupportTicketCategory;
    priority?: SupportTicketPriority;
    body: string;
  }): Promise<{ ticket: SupportTicket; message: SupportMessage }>;
  addUserMessage(input: {
    ticketId: UUID;
    userId: UUID;
    body: string;
    attachment?: SupportAttachmentInput;
  }): Promise<SupportMessage>;
  closeForUser(ticketId: UUID, userId: UUID): Promise<SupportTicket>;
  listForAdmin(filter?: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    priority?: SupportTicketPriority;
    assignedTo?: UUID | null;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<SupportTicketSummary>>;
  getForAdmin(ticketId: UUID): Promise<SupportTicketSummary | null>;
  addSupportMessage(input: {
    ticketId: UUID;
    actorId: UUID;
    body: string;
    attachment?: SupportAttachmentInput;
  }): Promise<SupportMessage>;
  updateTicket(input: {
    ticketId: UUID;
    actorId: UUID;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
    assignedTo?: UUID | null;
  }): Promise<SupportTicket>;
}

export interface NotificationRepository extends Repository {
  enqueue(input: EnqueueNotificationInput): Promise<{ id: UUID; queued: boolean }>;
  findByDedupeKey(dedupeKey: string): Promise<{
    id: UUID;
    status: string;
    body: string;
    data: Record<string, unknown> | null;
  } | null>;
  listForUser(userId: UUID, filter: { unreadOnly?: boolean; page?: number; pageSize?: number }): Promise<Paginated<{ id: UUID; eventKey: string; title: string; body: string; createdAt: ISODateString; readAt: ISODateString | null; data: Record<string, unknown> | null }>>;
  markRead(userId: UUID, ids: UUID[]): Promise<number>;
  markAllRead(userId: UUID): Promise<number>;
  claimOutbox(limit: number, workerId: string): Promise<{ id: UUID; channel: string; userId: UUID; eventKey: string; title: string; body: string; data: Record<string, unknown> | null; attempts: number }[]>;
  markDelivered(input: { id: UUID; status: 'sent' | 'failed' | 'suppressed'; providerMessageId?: string | null; error?: string | null }): Promise<void>;
  templates(): Promise<{ eventKey: string; channel: string; locale: string; subject: string | null; body: string; isEnabled: boolean }[]>;
  updateTemplate(input: { eventKey: string; channel: string; locale: string; subject?: string | null; body?: string; isEnabled?: boolean; actorId: UUID }): Promise<void>;
}
export interface EnqueueNotificationInput {
  userId: UUID; eventKey: string; channels?: string[]; title: string; body: string;
  data?: Record<string, unknown> | null; locale?: 'en'; scheduledAt?: ISODateString | null; dedupeKey?: string | null;
}

/** ------------------------------------------------------------------- admin/ops */
export interface AdminRepository extends Repository {
  dashboard(window: string): Promise<DashboardMetrics>;
  auditLog(filter: AuditFilter): Promise<Paginated<AuditLogEntry>>;
  writeAudit(input: { actorId: UUID | null; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown; reason?: string | null; correlationId?: string | null }): Promise<UUID>;
  roles(): Promise<{ key: string; label: string; permissions: string[]; isSystem: boolean; userCount: number }[]>;
  riskRules(): Promise<RiskRule[]>;
  upsertRiskRule(input: { rule: Partial<RiskRule> & { key: string }; actorId: UUID }): Promise<RiskRule>;
  settings(filter?: { category?: string; scope?: string }): Promise<SystemSetting[]>;
  updateSetting(input: { key: string; value: unknown; actorId: UUID }): Promise<SystemSetting>;
  killSwitches(): Promise<KillSwitchState[]>;
  setKillSwitch(input: { key: string; isActive: boolean; reason: string; actorId: UUID; expiresAt?: ISODateString | null }): Promise<KillSwitchState>;
  operations(): Promise<{ key: string; isEnabled: boolean; reason: string | null; updatedAt: ISODateString }[]>;
  setOperation(input: { key: string; isEnabled: boolean; reason: string; actorId: UUID }): Promise<{ key: string; isEnabled: boolean }>;
  maintenanceMode(): Promise<{ enabled: boolean; message: string | null; until: ISODateString | null }>;
  setMaintenance(input: { enabled: boolean; message: string; until?: ISODateString | null; actorId: UUID }): Promise<{ enabled: boolean }>;
  providerHealth(): Promise<ProviderHealth[]>;
  workerHeartbeats(): Promise<WorkerHeartbeat[]>;
  jobStats(): Promise<{ queue: string; pending: number; running: number; failed: number; dead: number; oldestPendingSeconds: number | null }[]>;
  listJobs(filter: { queue?: string; status?: string; page?: number; pageSize?: number }): Promise<Paginated<Job>>;
  retryJob(input: { jobId: UUID; actorId: UUID }): Promise<Job>;
  cancelJob(input: { jobId: UUID; actorId: UUID; reason: string }): Promise<Job>;
  runReconciliation(input: { periodStart?: ISODateString; periodEnd?: ISODateString; actorId?: UUID | null }): Promise<ReconciliationReport>;
  listReconciliations(limit: number): Promise<ReconciliationReport[]>;
}
export interface AuditFilter {
  actorId?: UUID; action?: string; entityType?: string; entityId?: string;
  from?: ISODateString; to?: ISODateString; search?: string; page?: number; pageSize?: number;
}

/** ------------------------------------------------------- jobs & worker support */
export interface JobRepository extends Repository {
  enqueue(input: { queue: string; kind: string; payload: Record<string, unknown>; priority?: number; runAfter?: ISODateString | null; idempotencyKey?: string | null; maxAttempts?: number }): Promise<{ id: UUID; enqueued: boolean }>;
  claim(input: { queue: string; workerId: string; limit: number; kinds?: string[] }): Promise<Job[]>;
  complete(input: { jobId: UUID; workerId: string; status: 'succeeded' | 'failed'; error?: string | null; result?: Record<string, unknown> | null; retryInMs?: number | null }): Promise<Job | null>;
  renewLease(input: { jobId: UUID; workerId: string; leaseSeconds?: number }): Promise<boolean>;
  heartbeat(input: { workerId: string; queue: string; status: string; processedCount: number; failedCount: number; currentJobId?: UUID | null; metrics?: Record<string, unknown> | null; staleAfterSeconds: number }): Promise<void>;
  acquireLock(input: { key: string; workerId: string; ttlSeconds: number }): Promise<boolean>;
  releaseLock(input: { key: string; workerId: string }): Promise<void>;
}
