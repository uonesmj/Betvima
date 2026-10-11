import { NextResponse } from 'next/server';
import { publicConfig, serverEnv } from '@/server/env';
import { createServices } from '@/server/services/container';
import { currentWeeklyPeriod, normalizeTimezone, settlementWindow, WEEKDAYS } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/** Public bootstrap: locale/currency/flags + authoritative operation switches. */
export async function GET(): Promise<Response> {
  const config = publicConfig();
  let operations: { key: string; isEnabled: boolean }[] = [];
  let maintenance = { enabled: false, message: null as string | null };
  try {
    const services = createServices();
    operations = (await services.admin.operations()).map((o) => ({ key: o.key, isEnabled: o.isEnabled }));
    maintenance = await services.admin.maintenanceMode();
  } catch {
    operations = [];
  }
  const env = serverEnv();
  const schedule = {
    day: env.AFFILIATE_SETTLEMENT_DAY, hour: env.AFFILIATE_SETTLEMENT_HOUR,
    minute: env.AFFILIATE_SETTLEMENT_MINUTE, timezone: normalizeTimezone(env.AFFILIATE_SETTLEMENT_TIMEZONE),
  };
  const now = new Date();
  const previous = settlementWindow(now, schedule);
  const period = currentWeeklyPeriod(now, schedule);

  return NextResponse.json(
    {
      ok: true,
      data: {
        ...config,
        operations, maintenance,
        affiliate: {
          defaultModel: process.env.AFFILIATE_DEFAULT_MODEL ?? 'NON_NEGATIVE_35',
          rateBps: Number(process.env.AFFILIATE_DEFAULT_RATE_BPS ?? 3500),
          minPayoutMinor: (process.env.AFFILIATE_MIN_PAYOUT_MINOR ?? '5000000'),
          settlement: {
            ...schedule,
            weekdayLabel: WEEKDAYS[schedule.day],
            // Both windows are computed from the IANA zone, so they stay correct across DST.
            lastWindowEndsAt: previous.periodEnd.toISOString(),
            nextWindowEndsAt: previous.periodStart.toISOString(),
            currentPeriodStart: period.start.toISOString(),
            currentPeriodEnd: period.end.toISOString(),
            localLabel: previous.localLabel,
          },
        },
        limits: { maxLegs: 20, minStakeMinor: '10', maxPayoutMinor: '2000000000' },
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
