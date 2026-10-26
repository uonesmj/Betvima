#!/usr/bin/env node
// BetVima: read-only regional RTT test. Does not invoke any wallet/payment callback.
// This tool runs outside Next.js. Explicit production mode is required to
// load the same .env.production.local that the running server/build uses.
process.env.NODE_ENV = 'production';
const { loadEnvConfig } = require(
  require.resolve('@next/env', { paths: [process.cwd()] }),
);
loadEnvConfig(process.cwd(), false);

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!projectUrl || !token || !token.startsWith('eyJ')) {
  console.log('STOP: PRODUCTION_SUPABASE_PUBLIC_CONFIG_UNAVAILABLE');
  console.log('PROJECT_URL_CONFIGURED=' + Boolean(projectUrl));
  console.log('ANON_JWT_CONFIGURED=' + Boolean(token?.startsWith('eyJ')));
  console.log('NO_FINANCIAL_OR_NETWORK_REQUEST_SENT');
  process.exit(1);
}

async function main() {
  const url = new URL('/functions/v1/betvima-db-rtt-probe', projectUrl);
  url.searchParams.set('forceFunctionRegion', 'eu-west-1');

  const start = performance.now();
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'apikey': token,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  const roundTripMs = Math.round((performance.now() - start) * 10) / 10;
  console.log('EDGE_HTTP_STATUS=' + res.status);
  console.log('VPS_TO_EDGE_HTTP_MS=' + roundTripMs);

  let response;
  try {
    response = await res.json();
  } catch {
    console.log('STOP: EDGE_RESPONSE_NOT_JSON');
    process.exitCode = 1;
    return;
  }
  if (!res.ok || response.ok !== true) {
    console.log('STOP: EDGE_PROBE_UNAVAILABLE');
    console.log('EDGE_ERROR=' + String(response.error || 'unknown').slice(0,80));
    process.exitCode = 1;
    return;
  }
  console.log('EDGE_REGION=' + String(response.region));
  console.log('EDGE_FIRST_DB_QUERY_MS=' + Number(response.first_query_ms));
  console.log('EDGE_WARM_DB_AVG_MS=' + Number(response.warm_query_avg_ms));
  console.log('EDGE_WARM_SAMPLES_MS=' +
    JSON.stringify(response.warm_query_samples_ms));
  if (response.region !== 'eu-west-1') {
    console.log('REGION_WARNING=NOT_EU_WEST_1');
  }
  console.log('READ_ONLY_PROBE_SUCCESS');
}

main().catch((e) => {
  console.log('STOP: PROBE_NETWORK_ERROR=' + String(e.code || e.name).slice(0,80));
  process.exitCode = 1;
});
