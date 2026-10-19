/**
 * SoftAggregator signed-ingress adapter for a dedicated Cloudflare route:
 *   betvima.com/api/webhooks/softaggregator*
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
 * No vendor credentials, wallet values, keys or callback data are logged.
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
    const secret = env.SOFTAGGREGATOR_EDGE_HMAC_SECRET;
    if (!exactIpAllowed(ip, env.SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS) ||
        typeof secret !== 'string' ||
        new TextEncoder().encode(secret).length < 32 ||
        url.searchParams.size > 24) return refuse();

    const names = [...url.searchParams.keys()];
    if (names.length !== new Set(names).size) return refuse();
    // The supplier documents its own full-payload X-Signature. Do not
    // overwrite it: backend verification requires both independent proofs.
    const vendorSignature = request.headers.get('x-signature');
    if (!/^[a-f0-9]{64}$/i.test(vendorSignature ?? '')) return refuse();

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
    return fetch(new Request(request, { headers }));
  },
};
