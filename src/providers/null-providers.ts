import { TheOddsApiSportsProvider } from "./the-odds-api";
import { NowPaymentsProvider } from "./nowpayments";
import { ResendEmailProvider } from './resend-email';
/**
 * NULL / DISABLED PROVIDERS (spec §7/§8 - "no provider configured is a first-class state").
 *
 * The platform must boot and behave honestly with zero external integrations:
 *   * odds ingestion reports NOT_CONFIGURED and changes nothing
 *   * deposits/withdrawals report NOT_CONFIGURED, no payment is ever faked
 *   * notifications are recorded as suppressed, never as delivered
 * Nothing here invents data, and every method returns a typed ProviderResult.
 */
import { serverEnv } from '@/server/env';
import type {
  NotificationMessage, NotificationProvider, PaymentProviderAdapter, ProviderPaymentIntent, ProviderResult,
  ProviderResultSnapshot, ProviderStatus, SportsDataProvider,
} from '@/lib/ports/providers';
import type { ISODateString } from '@/lib/types';
import type { LiveDataProvider } from '@/lib/ports/live-data-provider';
import { createLogger } from '@/server/logger';

const log = createLogger({ component: 'providers' });

const notConfigured = <T>(what: string, requiredEnv: string[]): ProviderResult<T> => {
  log.warn('provider call refused: not configured', { what, requiredEnv });
  return {
    ok: false, value: null, errorCode: 'NOT_CONFIGURED',
    errorMessage: `${what} requires configured provider credentials (${requiredEnv.join(', ')})`,
    retryable: false,
  };
};

/* ------------------------------------------------------------------ sports data */
export class DisabledSportsProvider implements SportsDataProvider {
  readonly name = 'disabled';
  readonly configured = false;
  private readonly requiredEnv = ['ODDS_API_KEY'];

  async health(): Promise<ProviderStatus> {
    return {
      provider: 'disabled', category: 'sports', configured: false, enabled: false, reachable: null,
      lastError: null, lastSuccessAt: null, requiredEnv: this.requiredEnv,
      notes: 'No sports data provider configured. Live scores, odds ingestion and automatic settlement of provider-driven markets stay off; administrative/manual settlement remains available.',
    };
  }
  async fetchMatches() { return notConfigured<never[]>('sports.fetchMatches', this.requiredEnv); }
  async fetchLiveMatches() { return notConfigured<never[]>('sports.fetchLiveMatches', this.requiredEnv); }
  async fetchOdds() { return notConfigured<never[]>('sports.fetchOdds', this.requiredEnv); }
  async fetchEventOdds() { return notConfigured<never[]>('sports.fetchEventOdds', this.requiredEnv); }
  async fetchResult() { return notConfigured<ProviderResultSnapshot>('sports.fetchResult', this.requiredEnv); }
  async fetchResults() { return notConfigured<never[]>('sports.fetchResults', this.requiredEnv); }
}

/* ---------------------------------------------------- disabled live metadata */
// The Odds API owns live scores/markets, but does not supply the separate
// player-event/statistics endpoint. Never silently call another vendor.
export class DisabledLiveDataProvider implements LiveDataProvider {
  readonly name = 'disabled';
  readonly configured = false;
  async health(): Promise<ProviderStatus> {
    return { provider: 'disabled', category: 'sports', configured: false,
      enabled: false, reachable: null, lastError: null, lastSuccessAt: null,
      requiredEnv: [],
      notes: 'Separate football live-statistics feed removed; The Odds API remains the sole sports source.' };
  }
  async fetchLiveFixtures() { return notConfigured<never[]>('live.fetchLiveFixtures', []); }
  async fetchEvents() { return notConfigured<never[]>('live.fetchEvents', []); }
  async fetchStatistics() { return notConfigured<never>('live.fetchStatistics', []); }
}

/* --------------------------------------------------------------------- payments */
export class DisabledPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'disabled';
  readonly configured = false;
  private readonly requiredEnv = ['PAYMENT_PROVIDER', 'PAYMENT_PROVIDER_API_KEY', 'PAYMENT_PROVIDER_MERCHANT_ID', 'PAYMENT_WEBHOOK_SECRET'];

  async health(): Promise<ProviderStatus> {
    return {
      provider: 'disabled', category: 'payments', configured: false, enabled: false, reachable: null,
      lastError: null, lastSuccessAt: null, requiredEnv: this.requiredEnv,
      notes: 'No payment provider configured. The deposit/withdrawal catalogue is visible but every method reports PAYMENT_PROVIDER_DISABLED; no intent can be created and no webhook can be accepted.',
    };
  }
  async listMethods() { return notConfigured<never[]>('payments.listMethods', this.requiredEnv); }
  async createDeposit() { return notConfigured<ProviderPaymentIntent>('payments.createDeposit', this.requiredEnv); }
  async createWithdrawal() { return notConfigured<ProviderPaymentIntent>('payments.createWithdrawal', this.requiredEnv); }
  async validateDestination() { return notConfigured<Record<string, unknown>>('payments.validateDestination', this.requiredEnv); }
  async executeWithdrawal() { return notConfigured<ProviderPaymentIntent>('payments.executeWithdrawal', this.requiredEnv); }
  async verifyAndParseWebhook() {
    return notConfigured<{ eventId: string; eventType: string; providerReference: string | null; status: string; amountMinor: bigint | null; currency: string | null; payload: Record<string, unknown> }>('payments.verifyWebhook', this.requiredEnv);
  }
  async refund() { return notConfigured<{ providerReference: string; status: 'succeeded' | 'failed'; raw?: Record<string, unknown> }>('payments.refund', this.requiredEnv); }
  async payoutStatus() { return notConfigured<{ status: string; raw?: Record<string, unknown> }>('payments.payoutStatus', this.requiredEnv); }
}

/* ---------------------------------------------------------------- notifications */
class DisabledNotificationProvider implements NotificationProvider {
  constructor(readonly channel: 'email' | 'sms' | 'push', private readonly requiredEnv: string[]) {}
  readonly name = 'disabled';
  readonly configured = false;

  async health(): Promise<ProviderStatus> {
    return {
      provider: 'disabled', category: 'notifications', configured: false, enabled: false, reachable: null,
      lastError: null, lastSuccessAt: null, requiredEnv: this.requiredEnv,
      notes: `No ${this.channel} provider configured. Deliveries are recorded as suppressed with an explicit reason and are never reported as sent.`,
    };
  }
  async send(_message: NotificationMessage): Promise<ProviderResult<{ providerMessageId: string | null }>> {
    return notConfigured(`notifications.${this.channel}`, this.requiredEnv);
  }
}

/* --------------------------------------------------------------------- registry */
export interface ProviderRegistryLike {
  sports: SportsDataProvider;
  sportsProviders?: SportsDataProvider[];
  live: LiveDataProvider;
  payments: PaymentProviderAdapter;
  email: NotificationProvider;
  sms: NotificationProvider;
  push: NotificationProvider;
  statuses(): Promise<ProviderStatus[]>;
}

let registry: ProviderRegistryLike | null = null;

/**
 * Resolve the provider registry. Real adapters are registered here when credentials
 * exist; without credentials everything resolves to the disabled implementations, so
 * the application never pretends to have an integration it does not have.
 */
export function providers(): ProviderRegistryLike {
  if (registry) return registry;
  const env = serverEnv();
  const oddsProvider = new TheOddsApiSportsProvider();
  // The Odds API is the only permitted sports data and bookmaker source.
  // No alternate football feed, fallback registry or implicit credentials.
  const sportsProviders = oddsProvider.configured ? [oddsProvider] : [];
  const primarySportsProvider = sportsProviders[0] ?? new DisabledSportsProvider();

  registry = {
    sports: primarySportsProvider,
    sportsProviders,
    live: new DisabledLiveDataProvider(),
    payments: env.PAYMENT_PROVIDER === 'nowpayments' ? new NowPaymentsProvider() : new DisabledPaymentProvider(),
    email: env.RESEND_API_KEY && env.RESEND_FROM_EMAIL
      ? new ResendEmailProvider()
      : new DisabledNotificationProvider('email', ['RESEND_API_KEY', 'RESEND_FROM_EMAIL']),
    sms: new DisabledNotificationProvider('sms', ['NOTIFY_SMS_PROVIDER', 'SMS_API_KEY']),
    push: new DisabledNotificationProvider('push', ['NOTIFY_PUSH_PROVIDER']),
    async statuses() {
      const sportsHealth = await Promise.all(
        (this.sportsProviders?.length ? this.sportsProviders : [this.sports]).map(
          (provider) => provider.health()
        )
      );
      const list = await Promise.all([
        ...sportsHealth,
        this.live.health(),
        this.payments.health(),
        this.email.health(),
        this.sms.health(),
        this.push.health(),
      ]);
      return list;
    },
  };
  // Loudly state the configuration state at boot: no silent degradation.
  log.info('provider registry resolved', {
    sports: primarySportsProvider.name, payments: env.PAYMENT_PROVIDER,
    email: env.RESEND_API_KEY ? 'resend' : 'disabled', sms: env.NOTIFY_SMS_PROVIDER, push: env.NOTIFY_PUSH_PROVIDER,
    sportsConfigured: env.sportsProviderEnabled, paymentsConfigured: env.paymentProviderEnabled,
  });
  return registry;
}

export function setProviders(next: ProviderRegistryLike | null): void {
  registry = next;
}

/** Persisted provider health rows (used by /admin/providers and /api/health). */
export async function providerHealthRows(db: { query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]> }) {
  return db.query(
    `select provider, kind, status, last_success_at, last_error, metadata from nova.provider_health
      where kind <> 'sports' or provider in ('the_odds_api', 'disabled')
      order by kind, provider`,
  );
}
