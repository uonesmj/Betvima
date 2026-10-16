import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { ApiError, withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { serverEnv } from '@/server/env';
import { clientIpFromHeaders, hashSignal } from '@/server/utils/hash';
import { getDb } from '@/server/db';
import { verifyTurnstileToken } from '@/server/security/turnstile';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().trim().min(1).max(2048),
});

export const POST = withErrorHandling('auth.login', async (ctx, request: Request) => {
  const env = serverEnv();

  await enforceRateLimit(
    `login:${clientIpFromHeaders(request.headers) ?? 'unknown'}`,
    10,
    900,
  );

  const body = await readJson(request, schema, ctx);

  await verifyTurnstileToken(body.turnstileToken, 'login');
  if (!env.supabaseConfigured) {
    throw new ApiError(
      'SERVICE_UNAVAILABLE',
      'Authentication backend is not configured',
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      data: {
        authenticated: true,
      },
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );

  const cookieHeader = request.headers.get('cookie') ?? '';

  const client = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () =>
          cookieHeader
            .split('; ')
            .filter(Boolean)
            .map((pair) => {
              const [name, ...rest] = pair.split('=');
              return {
                name: name!,
                value: rest.join('='),
              };
            }),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as never);
          });
        },
      },
    },
  );

  const authResponse = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
      cache: 'no-store',
    },
  );

  const authPayload = (await authResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    user?: { id?: string };
    error?: string;
    error_code?: string;
    msg?: string;
  } | null;

  if (
    !authResponse.ok ||
    !authPayload?.access_token ||
    !authPayload?.refresh_token ||
    !authPayload?.user?.id
  ) {
    const rateLimited =
      authResponse.status === 429 ||
      authPayload?.error_code === 'over_request_rate_limit';

    console.error('[AUTH_LOGIN_ERROR]', JSON.stringify({
      status: authResponse.status,
      error: authPayload?.error ?? null,
      errorCode: authPayload?.error_code ?? null,
      message: authPayload?.msg ?? null,
      hasAccessToken: Boolean(authPayload?.access_token),
      hasRefreshToken: Boolean(authPayload?.refresh_token),
      hasUser: Boolean(authPayload?.user?.id),
    }));

    throw new ApiError(
      rateLimited ? 'RATE_LIMITED' : 'VALIDATION_FAILED',
      rateLimited
        ? 'Too many login attempts. Please try again later.'
        : authPayload?.msg || 'Unable to sign in',
    );
  }

  const { data: sessionData, error: sessionError } =
    await client.auth.setSession({
      access_token: authPayload.access_token,
      refresh_token: authPayload.refresh_token,
    });

  if (sessionError || !sessionData.session || !sessionData.user) {
    console.error('[AUTH_LOGIN_SESSION_ERROR]', JSON.stringify({
      name: sessionError?.name ?? null,
      status: sessionError?.status ?? null,
      code: sessionError?.code ?? null,
      message: sessionError?.message ?? null,
      hasSession: Boolean(sessionData?.session),
      hasUser: Boolean(sessionData?.user),
    }));
    throw new ApiError(
      'SERVICE_UNAVAILABLE',
      'Unable to establish the login session',
    );
  }

  // Log only successful cookie-based logins with opaque network hash.
  // A telemetry failure must never prevent authentication.
  try {
    const ua = request.headers.get('user-agent') ?? '';
    const device = /Android/i.test(ua) ? 'Android browser'
      : /iPhone|iPad/i.test(ua) ? 'iPhone / iPad browser'
      : /Windows/i.test(ua) ? 'Windows browser'
      : /Mac OS/i.test(ua) ? 'Mac browser' : 'Web browser';
    const ip = clientIpFromHeaders(request.headers);
    await getDb().query(
      `insert into nova.account_events
         (user_id, actor_id, event_key, ip_hash, user_agent, metadata)
       values ($1, $1, 'security.login', $2, $3, $4::jsonb)`,
      [sessionData.user.id, ip ? hashSignal(ip) : null, device,
        JSON.stringify({ client: 'web', platform: device })],
    );
  } catch {
    console.warn('[auth.login] login history event was not stored');
  }
  return response;
});
