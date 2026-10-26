/**
 * BetVima Edge bridge SHADOW. NO FINANCIAL OPERATIONS.
 *
 * Only source-authenticated synthetic probes are accepted. The public Supabase
 * anon JWT (verify_jwt=true at deployment) alone NEVER authorizes a request.
 * Public Ed25519 SPKI key pinned from the operator's existing root-owned VPS
 * private key. It is safe to store this PUBLIC key in source control.
 *
 * This is deliberately a separate route from the existing SoftAggregator
 * callback. Production callback must stay on the Namecheap VPS:3098.
 */
// The Next.js monorepo typechecker does not enable TypeScript extension imports;
// Deno Edge requires explicit .ts URLs. Edge compilation resolves this import.
// @ts-ignore TS5097: required by Deno's explicit TypeScript import convention
import { verifyBridgeShadowProbe } from './verify.ts';
// @ts-ignore Deno npm: specifier is resolved by the Edge runtime, not Next.js.
import postgres from 'npm:postgres@3.4.5';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

// Pinned operator-provided Ed25519 PUBLIC key. The private key never leaves
// the existing VPS and must never be committed or sent to Supabase.
// Rotation requires a reviewed redeploy. Rejects any other signer's key.
const PINNED_BRIDGE_SHADOW_ED25519_SPKI_B64 =
  'MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=';

// Database connectivity is used for a HARD-CODED SELECT 1 ONLY and solely
// after authenticating a signed synthetic probe. No customer data or financial
// tables are queried and this route cannot post ledger entries.
const databaseUrl = Deno.env.get('SUPABASE_DB_URL') ?? '';
const sql = databaseUrl ? postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: 'require',
  connect_timeout: 10,
  idle_timeout: 60,
}) : null;

const reply = (status: number, payload: object): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });

  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 512)) {
    return reply(413, { error: 'PAYLOAD_TOO_LARGE' });
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return reply(415, { error: 'CONTENT_TYPE_REQUIRED' });
  }
  // Stream with a strict 512-byte ceiling. Reject chunked requests without
  // Content-Length before buffering unbounded untrusted input.
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { error: 'BODY_UNAVAILABLE' });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) {
        await reader.cancel().catch(() => undefined);
        return reply(413, { error: 'PAYLOAD_TOO_LARGE' });
      }
      chunks.push(value);
    }
  } catch {
    return reply(400, { error: 'BODY_UNAVAILABLE' });
  }
  if (size === 0) return reply(400, { error: 'EMPTY_BODY' });
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const check = await verifyBridgeShadowProbe(
    body,
    request.headers.get('x-betvima-bridge-signature') ?? '',
    PINNED_BRIDGE_SHADOW_ED25519_SPKI_B64,
    Deno.env.get('SB_REGION') ?? '',
  );
  if (!check.ok) return reply(401, { error: check.code });
  if (!sql) return reply(503, { error: 'READ_ONLY_PROBE_DB_NOT_CONFIGURED' });
  // Compare the first query (which may acquire a fresh DB connection)
  // with the next five on the same signed Edge invocation. All are hard-coded
  // read-only SELECT 1. No user IDs, amounts or mutable SQL are accepted.
  let dbQuerySamplesMs: number[];
  try {
    dbQuerySamplesMs = [];
    for (let i = 0; i < 6; i += 1) {
      const start = performance.now();
      const rows = await sql`SELECT 1::integer AS probe`;
      const elapsedMs = Math.round((performance.now() - start) * 10) / 10;
      if (Number(rows[0]?.probe) !== 1) throw new Error('DB_PROBE_BAD_RESULT');
      dbQuerySamplesMs.push(elapsedMs);
    }
  } catch {
    // Never emit connection details, SQL errors, access tokens or wallet data.
    return reply(503, { error: 'READ_ONLY_PROBE_DB_UNAVAILABLE' });
  }
  const warm = dbQuerySamplesMs.slice(1);
  const dbWarmAvgMs = Math.round(
    (warm.reduce((sum, ms) => sum + ms, 0) / warm.length) * 10,
  ) / 10;
  return reply(200, {
    // Backwards compatible first-query field; may include acquiring a
    // connection and is NOT the PostgreSQL query execution time alone.
    db_query_ms: dbQuerySamplesMs[0],
    db_first_query_ms: dbQuerySamplesMs[0],
    db_warm_query_avg_ms: dbWarmAvgMs,
    db_warm_query_samples_ms: warm,
    db_operation: 'SELECT_1',
    ok: true,
    signed_transport: true,
    region: 'eu-west-1',
    mode: 'SHADOW_ONLY',
    financial_operations_enabled: false,
    wallet_modified: false,
  });
});
