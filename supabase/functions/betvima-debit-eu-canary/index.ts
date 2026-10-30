/** BetVima EU Debit architecture canary.
 *
 * Real schema, synthetic non-existent UUID, SELECT-only SQL.
 * No balances, callbacks, wagering, credentials, usernames, identities,
 * financial ledgers or user data returned. Never route SoftAggregator here.
 * Existing 3098 money callback is the authoritative production endpoint.
 */
// @ts-ignore Deno edge import (.ts extension)
import { verifyDebitEuCanary } from './verify.ts';
// @ts-ignore Deno npm module import syntax
import postgres from 'npm:postgres@3.4.5';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const REGION = 'eu-west-1';
const PINNED_ED25519_PUBLIC_SPKI_B64 =
  'MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=';
const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';
const dbUrl = Deno.env.get('SUPABASE_DB_URL') ?? '';
// Never include a database URL in a response, source, trace, or log.
const sql = dbUrl ? postgres(dbUrl, {
  max: 1,
  prepare: false,
  ssl: 'require',
  connect_timeout: 10,
  idle_timeout: 60,
}) : null;

const json = (status: number, data: object): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
const ms = (n: number) => Math.round(n * 10) / 10;

async function readLimitedBody(req: Request): Promise<Uint8Array | null> {
  const length = req.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 512)) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 512) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  if (total < 1) return null;
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'POST_REQUIRED' });
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'JSON_REQUIRED' });
  }
  const body = await readLimitedBody(req);
  if (!body) return json(413, { error: 'INVALID_BODY_SIZE' });
  const gate = await verifyDebitEuCanary(
    body,
    req.headers.get('x-betvima-bridge-signature') ?? '',
    PINNED_ED25519_PUBLIC_SPKI_B64,
    Deno.env.get('SB_REGION') ?? '',
  );
  if (!gate.ok) return json(401, { error: gate.code });
  if (!sql) return json(503, { error: 'DATABASE_NOT_CONFIGURED' });

  // All SQL is static SELECT and exclusively against the zero UUID.
  // Do not accept customer, amount, call ID or SQL from the bridge payload.
  // This measures typical Debit READ shapes without changing any rows.
  const times: Array<{ phase: string; ms: number }> = [];
  const measured = async (phase: string, run: () => Promise<unknown>): Promise<void> => {
    const started = performance.now();
    await run();
    times.push({ phase, ms: ms(performance.now() - started) });
  };
  try {
    await measured('cold_or_reused_connection', async () => {
      await sql`SELECT 1::integer AS probe`;
    });
    await measured('financial_schema', async () => {
      await sql`SELECT to_regclass('nova.softaggregator_callback_receipts') IS NOT NULL AS ready`;
    });
    await measured('wallet_binding', async () => {
      await sql`SELECT wallet_currency FROM nova.softaggregator_player_wallet_bindings WHERE user_id = ${DUMMY_UUID}::uuid`;
    });
    await measured('round_lookup', async () => {
      await sql`SELECT wallet_currency FROM nova.softaggregator_round_fx WHERE user_id = ${DUMMY_UUID}::uuid AND round_id='edge-canary-no-match' AND game_id='edge-canary-no-match'`;
    });
    await measured('receipt_lookup', async () => {
      await sql`SELECT identity_hash FROM nova.softaggregator_callback_receipts WHERE call_id='edge-canary-no-match'`;
    });
    await measured('wallet_lookup', async () => {
      await sql`SELECT balance_minor,locked_minor,is_frozen FROM nova.wallets WHERE user_id=${DUMMY_UUID}::uuid AND currency='USD'`;
    });
    await measured('profile_lookup', async () => {
      await sql`SELECT status FROM nova.profiles WHERE id=${DUMMY_UUID}::uuid`;
    });
    await measured('limits_lookup', async () => {
      await sql`SELECT max_stake_per_day_minor FROM nova.user_limits WHERE user_id=${DUMMY_UUID}::uuid AND currency='USD'`;
    });
  } catch {
    // Server errors may contain table names and database details. Hide all.
    return json(503, { error: 'READ_ONLY_DB_PROBE_FAILED' });
  }
  const total = times.reduce((sum, item) => sum + item.ms, 0);
  return json(200, {
    ok: true,
    mode: 'SIGNED_SYNTHETIC_READ_ONLY',
    region: REGION,
    signed_transport: true,
    financial_operations_enabled: false,
    wallet_modified: false,
    sql_write_statements: 0,
    read_queries: times.length,
    db_total_ms: ms(total),
    phases: times,
  });
});
