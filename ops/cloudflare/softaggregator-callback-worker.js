/**
 * SoftAggregator signed-ingress adapter for a dedicated Cloudflare route:
 *   betvima.com/api/webhooks/softaggregator*
 * An exact allowlisted workers.dev hostname may be used for an isolated
 * non-monetary connectivity rehearsal without changing the site's nameservers.
 *
 * Vendor public docs: GET callback with MD5(timestamp + salt) ONLY.
 * Edge admits traffic exclusively from exact, operator-confirmed vendor IPs;
 * then signs ALL query fields with an independent HMAC secret. The backend
 * verifies BOTH the original vendor MD5 and this edge HMAC.
 *
 * Deployment prerequisites:
 *  - Provider IPs confirmed by vendor support (never guess their ranges).
 *  - SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS: exact comma-separated IPs, no CIDRs.
 *  - SOFTAGGREGATOR_EDGE_HMAC_SECRET: independent 32+ byte Worker secret;
 *    the same value is installed ONLY in the private backend environment.
 *  - Protect the origin from direct Internet access (Cloudflare Authenticated
 *    Origin Pulls / firewall / Tunnel). Avoid exposing another unsigned route.
 *  - Run live provider-origin pilot conformance before enabling cash flags.
 *
 * Diagnostic events contain fixed stage names only; no vendor credentials,\n * wallet values, URLs, query parameters, IPs, keys or signatures are logged.
 */
const WEBHOOK_PATH = '/api/webhooks/softaggregator';
const DENIED = { error: 2, balance: 0 };

function refuse() {
  return new Response(JSON.stringify(DENIED), {
    status: 200, headers: {
      'content-type': 'application/json', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

// Stages are intentionally low-information. They must never include a request,
 // query string, source address, account identifier, signature or secret.
function trace(stage) {
  console.info('softaggregator.callback.edge', stage);
}

function exactIpAllowed(ip, configured) {
  if (typeof ip !== 'string' || !/^[a-fA-F0-9:.]{3,45}$/.test(ip) ||
      typeof configured !== 'string' || configured.length > 1024) return false;
  const allowed = configured.split(',').map(x => x.trim());
  return allowed.length > 0 && allowed.length <= 12 &&
    allowed.every(x => /^[a-fA-F0-9:.]{3,45}$/.test(x)) &&
    new Set(allowed).size === allowed.length && allowed.includes(ip);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== WEBHOOK_PATH || request.method !== 'GET')
      return refuse();

    const ip = request.headers.get('cf-connecting-ip');
    // Unknown sources are refused without producing application log noise.
    if (!exactIpAllowed(ip, env.SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS))
      return refuse();
    const secret = env.SOFTAGGREGATOR_EDGE_HMAC_SECRET;
    if (typeof secret !== 'string' ||
        new TextEncoder().encode(secret).length < 32 ||
        url.searchParams.size > 24) {
      trace('refused_configuration_or_query_limit');
      return refuse();
    }

    const names = [...url.searchParams.keys()];
    if (names.length !== new Set(names).size) {
      trace('refused_duplicate_query_fields');
      return refuse();
    }
    // The supplier documents its own full-payload X-Signature. Do not
    // overwrite it: backend verification requires both independent proofs.
    const vendorSignature = request.headers.get('x-signature');
    if (!/^[a-f0-9]{64}$/i.test(vendorSignature ?? '')) {
      trace('refused_supplier_signature_format');
      return refuse();
    }
    // This confirms only the 64-hex shape, NOT HMAC verification.
    // Cryptographic validation remains the protected backend's responsibility.
    trace('supplier_signature_format_accepted');

    // Sign a uniquely percent-encoded canonical query, not delimiter-ambiguous
    // name=value pairs. The backend uses EXACTLY the same canonicalization.
    const sorted = [...url.searchParams.entries()].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0);
    const canonical = new URLSearchParams(sorted).toString();
    const signingKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const bytes = new Uint8Array(await crypto.subtle.sign(
      'HMAC', signingKey, new TextEncoder().encode(canonical),
    ));
    const signature = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    const headers = new Headers(request.headers);
    // Discard any client-supplied edge attestation and stamp our own.
    // Preserve the original vendor X-Signature for independent verification.
    headers.delete('x-betvima-edge-signature');
    headers.set('x-betvima-edge-signature', signature);
    headers.set('cache-control', 'no-store');

    // An unactivated Cloudflare DNS zone cannot receive this Route yet.
    // Allow the explicitly approved workers.dev hostname ONLY for an
    // isolated, non-monetary callback connectivity rehearsal. The workers.dev
    // URL has no DNS origin: forwarding the incoming Request unchanged would
    // try the workers.dev host again, not BetVima's HTTPS origin.
    if (url.hostname.endsWith('.workers.dev')) {
      if (url.hostname !== 'betvima-casino-callback.mimmim283228.workers.dev') {
        trace('refused_unapproved_worker_hostname');
        return refuse();
      }
      const origin = new URL('https://betvima.com' + WEBHOOK_PATH);
      origin.search = url.search;
      // Do not forward user cookies, authorization, client-supplied edge
      // attestations or incoming Cloudflare headers to the actual wallet API.
      const safeHeaders = new Headers({
        'x-signature': vendorSignature,
        'x-betvima-edge-signature': signature,
        'cache-control': 'no-store',
      });
      try {
        const response = await fetch(new Request(origin, {
          method: 'GET', headers: safeHeaders, redirect: 'manual',
        }));
        // The provider expects HTTP 200 with a JSON body on business errors.
        // Do not forward a redirect or upstream HTML error as a valid callback.
        if (response.status !== 200 ||
            !(response.headers.get('content-type') ?? '').includes('application/json')) {
          trace('origin_invalid_http_or_content_type');
          return refuse();
        }
        // Origin responded with HTTP 200 JSON. It can still contain error:2
        // while real-money processing is deliberately disabled.
        trace('origin_http_200_json');
        return response;
      } catch {
        trace('origin_fetch_exception');
        return refuse();
      }
    }

    // Existing active-zone route remains unchanged.
    trace('active_zone_forwarded');
    return fetch(new Request(request, { headers }));
  },
};
