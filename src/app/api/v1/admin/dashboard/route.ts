import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { searchParams } from '@/server/http/request';
import { section, type DegradedSection } from '@/server/http/degrade';
import type { ProviderStatus } from '@/lib/ports/providers';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.dashboard', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'dashboard.view');
  const window = z.enum(['24h', '7d', '30d']).catch('24h').parse(searchParams(request).get('window') ?? '24h');
  const degraded: DegradedSection[] = [];
  const [metrics, jobStats, heartbeats, providers] = await Promise.all([
    services.admin.dashboard(window),
    section('job_stats', degraded, () => services.admin.jobStats(), [], ctx.correlationId),
    section('worker_heartbeats', degraded, () => services.admin.workerHeartbeats(), [], ctx.correlationId),
    services.providers.statuses(),
  ]);
  const coverage = (metrics as typeof metrics & { financialCoverage?: { complete: boolean; excludedCurrencies: string[] } }).financialCoverage;
  if (coverage && !coverage.complete) {
    degraded.push({
      section: 'financial_currency_conversion',
      message: 'Financial totals are USD-only; non-USD amounts are excluded until a verified FX rate is available. Excluded currencies: ' + coverage.excludedCurrencies.join(', '),
    });
  }
  const config = services.providers;
  // Notification channels are reported straight from the registry - configured or not, never assumed.
  const channelRows: ProviderStatus[] = ([
    ['email', config.email, ['NOTIFY_EMAIL_PROVIDER', 'SMTP_URL']],
    ['sms', config.sms, ['NOTIFY_SMS_PROVIDER', 'SMS_API_KEY']],
    ['push', config.push, ['NOTIFY_PUSH_PROVIDER', 'PUSH_API_KEY']],
  ] as const).map(([channel, provider, requiredEnv]) => ({
    provider: provider.name, category: 'notifications' as const,
    configured: provider.configured, enabled: provider.configured, reachable: null,
    lastSuccessAt: null, lastErrorAt: null,
    lastError: provider.configured ? null : `${channel} channel not configured`,
    requiredEnv: [...requiredEnv],
    notes: provider.configured
      ? `${channel} channel configured`
      : `${channel} channel not configured: notifications are queued and every send returns NOT_CONFIGURED`,
  }));
  return jsonOk({ metrics, jobStats, workers: heartbeats, providers: [...providers, ...channelRows], degraded });
});
