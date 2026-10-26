#!/usr/bin/env node
// BetVima: read-only regional RTT test. Does not invoke any wallet/payment callback.
const { loadEnvConfig } = require(
  require.resolve('@next/env', { paths: [process.cwd()] }),
);
loadEnvConfig(process.cwd(), false);

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!projectUrl || !token || !token.startsWith('eyJ')) {
  console.log('STOP: PROJECT_URL_OR_LEGACY_ANON_JWT_NOT_CONFIGURED');
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
