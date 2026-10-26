// Read-only, temporary regional latency experiment for BetVima.
// This function is NOT a financial callback and must NEVER receive provider
// credentials, user IDs, amounts, wallet details or signed callback payloads.
// Keep Supabase gateway JWT verification enabled when deploying.
import postgres from 'npm:postgres@3.4.5';

const dbUrl = Deno.env.get('SUPABASE_DB_URL');
const sql = dbUrl
  ? postgres(dbUrl, {
      max: 1,
      prepare: false,
      ssl: 'require',
      connect_timeout: 10,
      idle_timeout: 20,
    })
  : null;

Deno.serve(async (request: Request): Promise<Response> => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405, headers,
    });
  }
  if (!sql) {
    return new Response(JSON.stringify({ error: 'DATABASE_CONFIGURATION_MISSING' }), {
      status: 503, headers,
    });
  }

  try {
    const samplesMs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const start = performance.now();
      // Hard-coded, read-only query. No parameters or user-controlled SQL.
      const result = await sql`SELECT 1 AS probe`;
      if (Number(result[0]?.probe) !== 1) {
        throw new Error('UNEXPECTED_DATABASE_RESULT');
      }
      samplesMs.push(Math.round((performance.now() - start) * 10) / 10);
    }
    const warm = samplesMs.slice(1);
    const average = warm.reduce((sum, ms) => sum + ms, 0) / warm.length;
    return new Response(JSON.stringify({
      ok: true,
      region: Deno.env.get('SB_REGION') ?? 'unknown',
      first_query_ms: samplesMs[0],
      warm_query_avg_ms: Math.round(average * 10) / 10,
      warm_query_samples_ms: warm,
      read_only: true,
      wallet_modified: false,
    }), { status: 200, headers });
  } catch {
    // No connection strings, secrets, SQL errors or user data in responses.
    return new Response(JSON.stringify({ error: 'DATABASE_PROBE_UNAVAILABLE' }), {
      status: 503, headers,
    });
  }
});
