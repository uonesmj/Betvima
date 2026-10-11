import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { ApiError, withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { serverEnv } from '@/server/env';
import { clientIpFromHeaders } from '@/server/utils/hash';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/),
  password: z.string().min(8).max(128),
});

export const POST = withErrorHandling(
  'affiliate.login',
  async (ctx, request: Request) => {
    await enforceRateLimit(
      `affiliate-login:${clientIpFromHeaders(request.headers) ?? 'unknown'}`,
      10,
      900,
    );

    const body = await readJson(request, schema, ctx);
    const db = getDb();

    const profile = await db.queryOne<{ email: string; role: string }>(
      `select email, role
         from nova.profiles
        where lower(username) = lower($1)
        limit 1`,
      [body.username],
    );

    if (!profile || profile.role !== 'affiliate' || !profile.email) {
      throw new ApiError('VALIDATION_FAILED', 'Invalid username or password');
    }

    const env = serverEnv();

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

    const cookieHeader = request.headers.get('cookie') || '';

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
                const parts = pair.split('=');
                return {
                  name: parts.shift() || '',
                  value: parts.join('='),
                };
              }),
          setAll: (
            items: Array<{
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }>,
          ) => {
            items.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as never);
            });
          },
        },
      },
    );

    const { data, error } = await client.auth.signInWithPassword({
      email: profile.email,
      password: body.password,
    });

    if (error || !data.user || !data.session) {
      throw new ApiError(
        'VALIDATION_FAILED',
        'Invalid username or password',
      );
    }

    return response;
  },
);
