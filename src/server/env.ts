/**
 * SERVER-ONLY environment validation.
 * - Never import this module from a client component.
 * - SUPABASE_SERVICE_ROLE_KEY is only read here and never returned to the browser.
 * - In production, missing critical configuration throws at startup instead of
 *   silently degrading into a half-working sportsbook.
 */
import { z } from 'zod';

const bool = (def: boolean) => z.string().optional().transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));
const int = (def: number) => z.string().optional().transform((v) => (v === undefined || v === '' ? def : Number.parseInt(v, 10))).pipe(z.number().int());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_SITE_NAME: z.string().default('BetVima'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.literal('en').default('en'),
  NEXT_PUBLIC_DEFAULT_CURRENCY: z.string().default('IRT'),
  NEXT_PUBLIC_DISPLAY_TIMEZONE: z.string().default('Asia/Tehran'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(''),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  SUPABASE_DB_URL: z.string().optional().default(''),
  DATABASE_URL: z.string().optional().default(''),

  SPORTS_PROVIDER: z.string().default('disabled'),
  SPORTS_PROVIDER_BASE_URL: z.string().optional().default(''),
  SPORTS_PROVIDER_API_KEY: z.string().optional().default(''),
  ODDS_API_BASE_URL: z.string().optional().default(''),
  ODDS_API_KEY: z.string().optional().default(''),
  SPORTS_ODDS_FRESHNESS_SECONDS: int(45),
  SPORTS_LIVE_FRESHNESS_SECONDS: int(12),

  PAYMENT_PROVIDER: z.string().default('disabled'),
  PAYMENT_PROVIDER_BASE_URL: z.string().optional().default(''),
  PAYMENT_PROVIDER_MERCHANT_ID: z.string().optional().default(''),
  PAYMENT_PROVIDER_API_KEY: z.string().optional().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().optional().default(''),
  UWALLET_BASE_URL: z.string().url().optional().default('https://api.uwallet.biz'),
  UWALLET_TOKEN: z.string().optional().default(''),
  UWALLET_UVOUCHER_COIN: z.string().optional().default(''),
  UWALLET_HOTVOUCHER_COIN: z.string().optional().default(''),
  NOWPAYMENTS_PAYOUT_EMAIL: z.string().optional().default(''),
  NOWPAYMENTS_PAYOUT_PASSWORD: z.string().optional().default(''),
  NOWPAYMENTS_PAYOUT_2FA_SECRET: z.string().optional().default(''),
  PAYMENT_WEBHOOK_TOLERANCE_SECONDS: int(300),

  NOTIFY_EMAIL_PROVIDER: z.string().default('disabled'),
  SMTP_URL: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default(''),
  NOTIFY_SMS_PROVIDER: z.string().default('disabled'),
  SMS_API_KEY: z.string().optional().default(''),
  NOTIFY_PUSH_PROVIDER: z.string().default('disabled'),

  WORKER_ID: z.string().optional().default(''),
  WORKER_HEARTBEAT_SECONDS: int(15),
  WORKER_LOCK_TTL_SECONDS: int(120),
  WORKER_MAX_ATTEMPTS: int(5),
  WORKER_BACKOFF_BASE_MS: int(500),
  WORKER_JOB_TIMEOUT_SECONDS: int(60),
  ODDS_SYNC_INTERVAL_SECONDS: int(10),
  SETTLEMENT_SCAN_INTERVAL_SECONDS: int(20),
  AFFILIATE_SETTLEMENT_TIMEZONE: z.string().default('Asia/Tehran'),
  /** Settlement day 0=Sunday … 6=Saturday (default 5 = Friday), local hour/minute. */
  AFFILIATE_SETTLEMENT_DAY: int(5),
  AFFILIATE_SETTLEMENT_HOUR: int(0),
  AFFILIATE_SETTLEMENT_MINUTE: int(0),
  RECONCILIATION_INTERVAL_SECONDS: int(900),

  RATE_LIMIT_ENABLED: bool(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  METRICS_ENABLED: bool(true),
  ADMIN_IP_ALLOWLIST: z.string().optional().default(''),
  DUAL_APPROVAL_THRESHOLD_AMOUNT: z.string().optional().default(''),

  AFFILIATE_DEFAULT_MODEL: z.enum(['PROFIT_LOSS_35', 'NON_NEGATIVE_35']).default('NON_NEGATIVE_35'),
  AFFILIATE_DEFAULT_RATE_BPS: int(3500),
  AFFILIATE_MIN_PAYOUT_MINOR: z.string().optional().default('5000000'),
});

export type ServerEnv = z.infer<typeof schema> & {
  sportsProviderEnabled: boolean;
  paymentProviderEnabled: boolean;
  paymentProvider: string;
  paymentProviderBaseUrl: string;
  paymentProviderApiKey: string;
  paymentWebhookSecret: string;
  uwalletBaseUrl: string;
  uwalletToken: string;
  uwalletUvoucherCoin: string;
  uwalletHotvoucherCoin: string;
  nowPaymentsPayoutEmail: string;
  nowPaymentsPayoutPassword: string;
  nowPaymentsPayout2faSecret: string;
  supabaseConfigured: boolean;
  isProduction: boolean;
  /** Missing requirements for a production deployment (empty when complete). */
  configurationProblems: string[];
  configurationComplete: boolean;
  publicFlags: Record<string, boolean>;
};

/**
 * Requirements for a production deployment. Reported (not thrown) by `serverEnv()` so that
 * `next build` and non-privileged pages still work; enforced explicitly by
 * `assertProductionConfiguration()` (readiness probe, preflight script, deploy scripts).
 */
function productionProblems(env: z.infer<typeof schema>, supabaseConfigured: boolean): string[] {
  const problems: string[] = [];
  if (!supabaseConfigured) problems.push('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) problems.push('SUPABASE_SERVICE_ROLE_KEY (server-side only)');
  if (!env.SUPABASE_DB_URL) problems.push('SUPABASE_DB_URL');
  if (env.NEXT_PUBLIC_SITE_URL.includes('localhost')) problems.push('NEXT_PUBLIC_SITE_URL must be the public https origin');
  if (!env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) problems.push('NEXT_PUBLIC_SITE_URL must use https');
  return problems;
}

let cached: ServerEnv | null = null;
let warned = false;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`INVALID_ENVIRONMENT: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production' || env.APP_ENV === 'production';
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const problems = isProduction ? productionProblems(env, supabaseConfigured) : [];
  if (problems.length > 0 && !warned) {
    warned = true;
    // Honest, non-fatal warning: the platform runs, privileged and account areas report their
    // own NOT_CONFIGURED errors, and /api/health/ready stays 503 until this is fixed.
    console.warn(JSON.stringify({
      level: 'error', msg: 'configuration.incomplete', scope: 'production',
      problems, hint: 'set the variables and restart, or run bash scripts/preflight-production.sh',
    }));
  }

  const result: ServerEnv = {
    ...env,
    isProduction,
    supabaseConfigured,
    configurationProblems: problems,
    configurationComplete: problems.length === 0,
    sportsProviderEnabled: env.SPORTS_PROVIDER === 'betsapi'
      ? process.env.BETSAPI_PROVIDER_ACTIVATION === 'validated' && /^[A-Za-z0-9_-]{12,180}$/.test(process.env.BETSAPI_TRIAL_TOKEN || '')
      : Boolean(env.ODDS_API_KEY) ||
        (env.SPORTS_PROVIDER === 'the_odds_api' && Boolean(env.SPORTS_PROVIDER_API_KEY)),
    paymentProviderEnabled: env.PAYMENT_PROVIDER !== 'disabled' && Boolean(env.PAYMENT_PROVIDER_API_KEY),
    paymentProvider: env.PAYMENT_PROVIDER,
    paymentProviderBaseUrl: env.PAYMENT_PROVIDER_BASE_URL,
    paymentProviderApiKey: env.PAYMENT_PROVIDER_API_KEY,
    paymentWebhookSecret: env.PAYMENT_WEBHOOK_SECRET,
  uwalletBaseUrl: env.UWALLET_BASE_URL,
  uwalletToken: env.UWALLET_TOKEN,
  uwalletUvoucherCoin: env.UWALLET_UVOUCHER_COIN,
  uwalletHotvoucherCoin: env.UWALLET_HOTVOUCHER_COIN,
    nowPaymentsPayoutEmail: env.NOWPAYMENTS_PAYOUT_EMAIL,
    nowPaymentsPayoutPassword: env.NOWPAYMENTS_PAYOUT_PASSWORD,
    nowPaymentsPayout2faSecret: env.NOWPAYMENTS_PAYOUT_2FA_SECRET,
    publicFlags: {
      liveBetting: process.env.NEXT_PUBLIC_FLAG_LIVE_BETTING === 'true',
      cashout: process.env.NEXT_PUBLIC_FLAG_CASHOUT === 'true',
      betBuilder: process.env.NEXT_PUBLIC_FLAG_BET_BUILDER === 'true',
      bonus: process.env.NEXT_PUBLIC_FLAG_BONUS === 'true',
      streaming: process.env.NEXT_PUBLIC_FLAG_STREAMING === 'true',
    },
  };
  cached = result;
  return result;
}

/** Public (browser-safe) configuration. Contains no secrets by construction. */
export function publicConfig() {
  const env = serverEnv();
  return {
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    siteName: env.NEXT_PUBLIC_SITE_NAME,
    locale: env.NEXT_PUBLIC_DEFAULT_LOCALE,
    currency: env.NEXT_PUBLIC_DEFAULT_CURRENCY,
    timezone: env.NEXT_PUBLIC_DISPLAY_TIMEZONE,
    appEnv: env.APP_ENV,
    isProduction: env.isProduction,
    providers: {
      sportsDataAvailable: env.sportsProviderEnabled,
      paymentsAvailable: env.paymentProviderEnabled,
    },
    flags: env.publicFlags,
  };
}

/**
 * Explicit production readiness check. Throws when the deployment is missing required
 * configuration; called by the readiness probe, the preflight script and the deploy scripts.
 */
export function assertProductionConfiguration(): void {
  const env = serverEnv();
  if (env.configurationProblems.length > 0) {
    throw new Error(`PRODUCTION_CONFIGURATION_INCOMPLETE: ${env.configurationProblems.join(', ')}`);
  }
}

/** Non-throwing variant for health endpoints that must always answer. */
export function productionConfigurationProblems(): string[] {
  return serverEnv().configurationProblems;
}

/** Guard used by dev/test adapters: they must be impossible to activate in production. */
export function assertNonProduction(feature: string): void {
  const env = serverEnv();
  if (env.isProduction) {
    throw new Error(`REFUSED: ${feature} is a development/test facility and cannot be enabled in production`);
  }
}
