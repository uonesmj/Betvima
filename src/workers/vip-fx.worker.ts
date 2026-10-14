/**
 * One-shot FX evidence importer; only historical prices from the configured
 * trusted provider. Does not place bets, change balances or credit cashback.
 *
 * Deploy as a separate systemd timer BEFORE the Monday finance cron so
 * missing-rate candidates can be safely held instead of using current FX.
 */
import { getDb, closeDb } from '@/server/db';
import { syncVipHistoricalFx } from '@/server/providers/arzhaam/history';

async function main(): Promise<void> {
  const db = getDb();
  const result = await syncVipHistoricalFx(db,'30d');
  console.info(JSON.stringify({ worker: 'vip-historical-fx', event: 'synced',
    pointsFetched: result.fetched, pointsInserted: result.inserted }));
}

if (process.env.NOVA_VIP_FX_ENTRYPOINT === 'true') {
  void main().catch((error) => {
    console.error(JSON.stringify({ worker: 'vip-historical-fx', event: 'sync_failed',
      error: error instanceof Error ? error.message.slice(0,180) : 'unknown' }));
    process.exitCode = 1;
  }).finally(() => closeDb().catch(() => undefined));
}
