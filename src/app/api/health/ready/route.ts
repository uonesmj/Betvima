import { NextResponse } from 'next/server';
import { createServices } from '@/server/services/container';
import { productionConfigurationProblems, serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Readiness probe for the load balancer. Answers 503 until:
 *  - the database answers, and
 *  - (in production) the required configuration is present.
 * The body explains exactly what is missing - readiness is never faked.
 */
export async function GET(): Promise<Response> {
  const problems = productionConfigurationProblems();
  const env = serverEnv();
  const configuration = { complete: env.configurationComplete, problems, isProduction: env.isProduction };

  let database: { ok: boolean; latencyMs: number | null; message: string | null } = { ok: false, latencyMs: null, message: 'not checked' };
  try {
    const services = createServices();
    const ping = await services.db.ping();
    database = { ok: ping.ok, latencyMs: ping.latencyMs, message: ping.message ?? null };
  } catch (error) {
    database = { ok: false, latencyMs: null, message: error instanceof Error ? error.message : 'unknown error' };
  }

  const ready = database.ok && configuration.complete;
  return NextResponse.json(
    {
      ready,
      status: ready ? 'ok' : 'down',
      latencyMs: database.latencyMs,
      message: database.ok
        ? (configuration.complete ? null : `PRODUCTION_CONFIGURATION_INCOMPLETE: ${problems.join(', ')}`)
        : (database.message ?? 'database unreachable'),
      database,
      configuration,
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
