/**
 * External provider contracts (spec §7, §8).
 *
 * Providers are OPTIONAL: the platform boots, serves every route and reports honest
 * "unavailable" states when no credentials are configured. No fake odds, no fake
 * payment success - ever. `NullXProvider` returns NOT_CONFIGURED; `DisabledXProvider`
 * is used when a feature is intentionally switched off.
 */
import type { ISODateString, PaymentMethod, UUID } from '@/lib/types';
import type { LiveDataProvider } from './live-data-provider';

export type ProviderCategory = 'sports' | 'payments' | 'notifications';
export interface ProviderStatus {
  provider: string; category: ProviderCategory; configured: boolean; enabled: boolean;
  reachable: boolean | null; lastError: string | null; lastSuccessAt: ISODateString | null;
  requiredEnv: string[]; notes: string;
}
export interface ProviderResult<T> {
  ok: boolean;
  value: T | null;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

/* ------------------------------------------------------------------ sports data */
export interface ProviderMatch {
  providerId: string; sport: string; leagueProviderId: string | null; leagueName: string | null; countryCode: string | null;
  homeTeamName: string; awayTeamName: string; scheduledAt: ISODateString; status: string;
  homeScore: number | null; awayScore: number | null; minute: number | null; period: string | null;
  homeTeamProviderId?: string | null; awayTeamProviderId?: string | null;
  homeHalfScore?: number | null; awayHalfScore?: number | null;
  liveEvents?: unknown[];
  liveStats?: unknown;
}
export interface ProviderOddsSelection { providerId: string; code: string; name: string; line: string | null; odds: string; status: string }
export interface ProviderOddsMarket { providerId: string; key: string; type: string; specifier: string | null; isLive: boolean; status: string; sourceUpdatedAt?: string; selections: ProviderOddsSelection[] }
export interface ProviderOddsBundle { matchProviderId: string; markets: ProviderOddsMarket[]; updatedAt: ISODateString }
export interface ProviderResultSnapshot {
  matchProviderId: string; status: string; homeScore: number | null; awayScore: number | null;
  homeHalfScore: number | null; awayHalfScore: number | null;
  homeCorners: number | null; awayCorners: number | null; homeCards: number | null; awayCards: number | null;
  extraTime: boolean; penalties: boolean; penaltyHome: number | null; penaltyAway: number | null;
  revision: number; observedAt: ISODateString; authoritative: boolean;
}
export interface SportsDataProvider {
  readonly name: string;
  readonly configured: boolean;
  health(): Promise<ProviderStatus>;
  fetchMatches(window: { from: ISODateString; to: ISODateString; sport?: string }): Promise<ProviderResult<ProviderMatch[]>>;
  fetchLiveMatches(sport?: string): Promise<ProviderResult<ProviderMatch[]>>;
  fetchFixture?: (matchProviderId: string) => Promise<ProviderResult<ProviderMatch>>;
  fetchTeamFixtures?: (
    teamProviderId: string,
    options?: { page?: number; perPage?: number },
  ) => Promise<ProviderResult<ProviderMatch[]>>;
  fetchOdds(matchProviderIds: string[]): Promise<ProviderResult<ProviderOddsBundle[]>>;
  fetchEventOdds(matchProviderIds: string[]): Promise<ProviderResult<ProviderOddsBundle[]>>;
  fetchResult(matchProviderId: string): Promise<ProviderResult<ProviderResultSnapshot>>;
  fetchResults(
    from: ISODateString,
    to: ISODateString,
    matchProviderIds?: string[],
  ): Promise<ProviderResult<ProviderResultSnapshot[]>>;
}

/* --------------------------------------------------------------------- payments */
export interface ProviderPaymentIntent {
  providerReference: string; status: 'pending' | 'requires_action' | 'processing' | 'succeeded' | 'failed';
  redirectUrl: string | null; expiresAt: ISODateString | null; raw?: Record<string, unknown>;
}
export interface PaymentProviderAdapter {
  readonly name: string;
  readonly configured: boolean;
  health(): Promise<ProviderStatus>;
  listMethods(input: { direction: 'deposit' | 'withdrawal'; currency: string; amountMinor?: bigint }): Promise<ProviderResult<PaymentMethod[]>>;
  createDeposit(input: { intentId: UUID; publicId: string; amountMinor: bigint; currency: string; methodId: string; userId: UUID; returnUrl: string | null; idempotencyKey: string }): Promise<ProviderResult<ProviderPaymentIntent>>;
  createWithdrawal(input: { intentId: UUID; publicId: string; amountMinor: bigint; currency: string; methodId: string; userId: UUID; destination: Record<string, unknown> | null; idempotencyKey: string }): Promise<ProviderResult<ProviderPaymentIntent>>;
  verifyAndParseWebhook(input: { rawBody: string; headers: Record<string, string>; secret: string; toleranceSeconds: number }): Promise<ProviderResult<{ eventId: string; eventType: string; providerReference: string | null; status: string; amountMinor: bigint | null; currency: string | null; payload: Record<string, unknown> }>>;
  refund(input: { providerReference: string; amountMinor: bigint; idempotencyKey: string; reason: string }): Promise<ProviderResult<{ providerReference: string; status: 'succeeded' | 'failed'; raw?: Record<string, unknown> }>>;
  validateDestination(
    address: string,
    currency: string,
  ): Promise<ProviderResult<Record<string, unknown>>>;
  executeWithdrawal(input: {
    intentId: UUID;
    publicId: string;
    amountMinor: bigint;
    currency: string;
    methodId: string;
    userId: UUID;
    destination: Record<string, unknown> | null;
    providerMetadata: Record<string, unknown> | null;
    idempotencyKey: string;
  }): Promise<ProviderResult<ProviderPaymentIntent>>;
  payoutStatus(providerReference: string): Promise<ProviderResult<{ status: string; raw?: Record<string, unknown> }>>;
}

/* ---------------------------------------------------------------- notifications */
export interface NotificationMessage {
  to: string; subject: string | null; body: string; locale: 'en';
  data?: Record<string, unknown>; channel: 'email' | 'sms' | 'push';
}
export interface NotificationProvider {
  readonly channel: 'email' | 'sms' | 'push';
  readonly name: string;
  readonly configured: boolean;
  health(): Promise<ProviderStatus>;
  send(message: NotificationMessage): Promise<ProviderResult<{ providerMessageId: string | null }>>;
}

/* --------------------------------------------------------------------- registry */
export interface ProviderRegistry {
  sports: SportsDataProvider;
  sportsProviders?: SportsDataProvider[];
  payments: PaymentProviderAdapter;
  email: NotificationProvider;
  sms: NotificationProvider;
  push: NotificationProvider;
  live: LiveDataProvider;
  statuses(): Promise<ProviderStatus[]>;
}
