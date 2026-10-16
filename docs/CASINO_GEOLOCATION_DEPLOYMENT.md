# BetVima — enforce current location for live-money casino (deployment blocked)

The user profile `nova.profiles.jurisdiction` is a KYC/account attribute,
**not** the user's current physical country. SoftAggregator trusts the `country`
sent by the operator's `getGame` request and does not geolocate the player.
The casino must **not** equate provider game availability with an operating licence.

## Implementation

`src/server/providers/softaggregator/edge-location.ts` independently
verifies a short-lived HMAC-SHA256 country attestation on the HTTPS casino
eligibility and game launch routes. The request country comes from Cloudflare
edge metadata `request.cf.country`, not the player's browser, Android client,
profile edits, `CF-IPCountry`, `X-Forwarded-For`, or a bare `CF-Connecting-IP`
header. The signed statement includes timestamp, HTTP method, URL pathname,
country and Cloudflare-observed IP; replay is limited to 45 seconds.

An absent, invalid, stale, unlicensed or mismatched country returns a disabled
eligibility or a 403 launch error. The launch must also pass ordinary KYC,
self-exclusion, native wallet, financial schema and single-account pilot
checks. A valid geo token **does not enable money mode** by itself.

## Prerequisites (not automatically provisioned by GitHub)

1. Obtain written operator gambling permissions, eligible country codes,
   game restrictions and approved Android distribution territories.
   Only legally authorized two-letter ISO codes belong in the private
   `SOFTAGGREGATOR_ALLOWED_COUNTRIES` configuration; never use '*',
   provider game-list countries, or automatically guessed regions.
2. Verify the *actual* traffic path in Cloudflare: public `betvima.com`
   proxied through Cloudflare; Next.js reachable only via loopback behind
   trusted Nginx, not directly from the internet. Prevent direct-origin
   bypass and lock down backend ports. The edge must be the only entity
   allowed to sign geo headers.
3. Through the operator's Cloudflare account deploy the Worker source
   `ops/cloudflare/casino-geo-worker.js` on the casino API route
   `betvima.com/api/v1/casino/*`. If that route already has a Worker,
   merge the small signing handler into that Worker; **do not** overwrite
   an existing authentication/proxy handler. Route settings and the
   domain need to be verified before publication.
4. Generate a random secret of **at least 32 bytes** securely (prefer 32
   random bytes encoded as hex). Store it as a Cloudflare Worker secret
   `CASINO_GEO_HMAC_SECRET`, and as the **same private environment secret**
   for the backend process. Never put it into source control, shell
   history, screenshots, Android assets, edge response, or GitHub logs.
5. Ensure the Worker strips any client-supplied
   `X-BetVima-Geo-Country`, `-Ip`, `-Timestamp` and `-Signature` headers
   before it signs and forwards requests. Signed attestation must **not**
   be copied into browser-visible response headers, caches or log data.
6. Test a staging or tightly restricted private pilot across an actual
   eligible country, an unlicensed country, a missing Cloudflare location,
   client spoofed headers, expired signatures, HTTP method/path replay,
   VPN/proxy risk and a KYC/profile-country mismatch. A simple IP-country
   value alone does **not** prove physical presence against VPN, GPS
   spoofing or proxy services; additional compliance/risk checks may
   be required in relevant jurisdictions.
7. Confirm the backend receives Worker signatures with clock skew under
   45 seconds. Secret rotation must be coordinated on both sides; removing
   or changing the secret fails closed. Test app eligibility and demo
   independently after Worker install to avoid breaking demo-only play.
8. Separately satisfy all financial controls, real signed supplier callback
   conformance, verified recoverable Production backup and migration approval
   before enabling a single-user real-money pilot.

## What access is required?

GitHub source access and Supabase SQL access **do not grant control over**
the production VPS process environment or Cloudflare Worker routes/secrets.
The operator's VPS SSH access can configure the protected backend environment
and firewall, but Cloudflare Worker deployment requires Cloudflare dashboard
or equivalent authorized deployment access as well.

This change is intentionally code-and-tests only. No Worker deployed; no
production secrets or country authorization configured; no public money mode.
