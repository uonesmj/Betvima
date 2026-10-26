/**
 * BetVima Edge bridge SHADOW. NO FINANCIAL OPERATIONS.
 *
 * Only source-authenticated synthetic probes are accepted. The public Supabase
 * anon JWT (verify_jwt=true at deployment) alone NEVER authorizes a request.
 * Environment: BV_CASINO_BRIDGE_ED25519_SPKI_B64 (public key, NOT a secret).
 *
 * This is deliberately a separate route from the existing SoftAggregator
 * callback. Production callback must stay on the Namecheap VPS:3098.
 */
// The Next.js monorepo typechecker does not enable TypeScript extension imports;
// Deno Edge requires explicit .ts URLs. Edge compilation resolves this import.
// @ts-ignore TS5097: required by Deno's explicit TypeScript import convention
import { verifyBridgeShadowProbe } from './verify.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

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
  const key = Deno.env.get('BV_CASINO_BRIDGE_ED25519_SPKI_B64') ?? '';
  if (!key) return reply(503, { error: 'SHADOW_VERIFY_KEY_NOT_CONFIGURED' });

  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 512)) {
    return reply(413, { error: 'PAYLOAD_TOO_LARGE' });
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return reply(415, { error: 'CONTENT_TYPE_REQUIRED' });
  }
  let body: Uint8Array;
  try {
    body = new Uint8Array(await request.arrayBuffer());
  } catch {
    return reply(400, { error: 'BODY_UNAVAILABLE' });
  }
  if (body.byteLength > 512 || body.byteLength === 0) {
    return reply(413, { error: 'PAYLOAD_SIZE_INVALID' });
  }

  const check = await verifyBridgeShadowProbe(
    body,
    request.headers.get('x-betvima-bridge-signature') ?? '',
    key,
    Deno.env.get('SB_REGION') ?? '',
  );
  if (!check.ok) return reply(401, { error: check.code });
  return reply(200, {
    ok: true,
    signed_transport: true,
    region: 'eu-west-1',
    mode: 'SHADOW_ONLY',
    financial_operations_enabled: false,
    wallet_modified: false,
  });
});
