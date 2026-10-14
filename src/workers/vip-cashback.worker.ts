/**
 * One-shot finance worker. Run from the dedicated systemd Monday timer.
 * Defaults to READ-ONLY until reviewed and enabled independently in BOTH places:
 *   env NOVA_VIP_CASHBACK_AUTOPAY=true
 *   nova.system_operations['VIP_CASHBACK_PAYOUT'].enabled=true
 *
 * A missed Monday may catch up during the same local calendar week.
 * Older periods deliberately require a separately reviewed backfill workflow.
 */
import { getDb, closeDb } from '@/server/db';

const TIMEZONE = 'Asia/Tehran';

export function currentCompletedCashbackWeek(now: Date): {
  start: string; localDay: number; localHour: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  const hour = Number(value('hour'));
  const localToday = new Date(Date.UTC(year, month - 1, day));
  const localIsoDay = ((localToday.getUTCDay() + 6) % 7) + 1;
  const previousMonday = new Date(localToday.getTime() - (localIsoDay - 1 + 7) * 86_400_000);
  return { start: previousMonday.toISOString().slice(0, 10), localDay: localIsoDay, localHour: hour };
}

interface QuoteRow {
  user_id: string;
  deposit_minor: string;
  loss_minor: string;
  rate_bps: number;
  cashback_minor: string;
}

export async function runVipCashback(now: Date = new Date()): Promise<{
  weekStart: string; mode: 'preview' | 'enabled'; eligible: number;
  paid: number; skipped: number; failed: number; amountMinor: string;
}> {
  const week = currentCompletedCashbackWeek(now);
  // Do not run before 09:00 on Monday in Tehran, even in preview mode.
  if (week.localDay === 1 && week.localHour < 9) {
    throw new Error('VIP_CASHBACK_WAIT_UNTIL_MONDAY_09_TEHRAN');
  }
  const live = process.env.NOVA_VIP_CASHBACK_AUTOPAY === 'true';
  const db = getDb();
  const candidates = await db.query<QuoteRow>(
    'select user_id, deposit_minor::text, loss_minor::text, rate_bps, cashback_minor::text ' +
    'from nova.vip_cashback_quote_week($1::date) where cashback_minor > 0 order by user_id',
    [week.start],
    { timeoutMs: 60_000 },
  );
  // DB operation switch is checked independently by the authoritative credit RPC.
  // Reconciliation is write-bearing and runs only when the worker is explicitly enabled.
  if (live) {
    const anomalies = await db.rpc<number>('vip_cashback_reconcile', { p_lookback_weeks: 12 });
    if (Number(anomalies) > 0) {
      console.warn(JSON.stringify({ worker: 'vip-cashback', event: 'financial_discrepancies_detected', count: anomalies }));
    }
  }
  let paid = 0;
  let skipped = 0;
  let failed = 0;
  let amountMinor = 0n;
  for (const row of candidates) {
    try {
      const result = await db.rpc<Record<string, unknown>>('vip_cashback_credit_user', {
        p_week_start: week.start,
        p_user_id: row.user_id,
        p_dry_run: !live,
      });
      const status = String(result?.status ?? '');
      if (status === 'credited') {
        paid += 1;
        amountMinor += BigInt(String(result.amount_minor));
      } else if (['preview', 'already_paid', 'not_eligible', 'no_longer_eligible'].includes(status)) {
        skipped += 1;
      } else {
        throw new Error('VIP_UNKNOWN_CREDIT_STATUS:' + status);
      }
    } catch (error) {
      failed += 1;
      // Never echo credentials, user balances or account-specific identifiers in logs.
      console.error(JSON.stringify({
        worker: 'vip-cashback', event: 'credit_failed',
        error: error instanceof Error ? error.message.slice(0, 180) : 'unknown',
      }));
    }
  }
  const summary = {
    weekStart: week.start,
    mode: live ? 'enabled' as const : 'preview' as const,
    eligible: candidates.length,
    paid, skipped, failed,
    amountMinor: amountMinor.toString(),
  };
  console.info(JSON.stringify({ worker: 'vip-cashback', event: 'weekly_run', ...summary }));
  if (failed > 0) throw new Error('VIP_CASHBACK_PARTIAL_FAILURE:' + failed);
  return summary;
}

// Keep imports testable without immediately launching a worker.
if (process.env.NOVA_VIP_CASHBACK_ENTRYPOINT === 'true') {
  void runVipCashback().catch((error) => {
    console.error(JSON.stringify({ worker: 'vip-cashback', event: 'run_failed',
      message: error instanceof Error ? error.message.slice(0, 180) : 'unknown' }));
    process.exitCode = 1;
  }).finally(() => closeDb().catch(() => undefined));
}
