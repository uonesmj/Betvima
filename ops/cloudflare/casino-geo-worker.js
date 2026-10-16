/**
 * Cloudflare Worker template for the proxied betvima.com/api/v1/casino/* route.
 * Deploy only through the operator's Cloudflare account. Set the SAME
 * CASINO_GEO_HMAC_SECRET as a Worker secret and a private backend secret.
 *
 * Country comes from Cloudflare request.cf COUNTRY metadata, NOT any request
 * header or the user's profile. Never expose the signing key in responses,
 * source control, Android or public assets. Keep origin ports restricted.
 *
 * If metadata is unavailable, strip client-supplied headers and fail closed:
 * catalogue/demo remain usable, money endpoints refuse cash wagering.
 */
const ATTESTATION_HEADERS = [
  'x-betvima-geo-country',
  'x-betvima-geo-ip',
  'x-betvima-geo-timestamp',
  'x-betvima-geo-signature',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    for (const name of ATTESTATION_HEADERS) headers.delete(name);

    const country = request.cf?.country;
    const ip = request.headers.get('cf-connecting-ip');
    const secret = env.CASINO_GEO_HMAC_SECRET;
    // Only issue a country attestation for routes that actually consume it.
    // The catalogue/demo and unrelated API endpoints must never receive one.
    const needsGeoAttestation =
      (url.pathname === '/api/v1/casino/launch' && request.method === 'POST') ||
      (url.pathname === '/api/v1/casino/eligibility' && request.method === 'GET');
    if (needsGeoAttestation &&
        typeof secret === 'string' && new TextEncoder().encode(secret).length >= 32 &&
        typeof country === 'string' && /^[A-Z]{2}$/.test(country) &&
        typeof ip === 'string' && /^[a-fA-F0-9.:]{3,45}$/.test(ip)) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const canonical = ['v1', timestamp, request.method.toUpperCase(),
        url.pathname, country, ip].join('\n');
      const signingKey = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const mac = new Uint8Array(await crypto.subtle.sign(
        'HMAC', signingKey, new TextEncoder().encode(canonical)));
      const signature = [...mac].map(x => x.toString(16).padStart(2, '0')).join('');
      headers.set('x-betvima-geo-country', country);
      headers.set('x-betvima-geo-ip', ip);
      headers.set('x-betvima-geo-timestamp', timestamp);
      headers.set('x-betvima-geo-signature', signature);
    }

    const upstream = new Request(request, { headers });
    return fetch(upstream);
  },
};
