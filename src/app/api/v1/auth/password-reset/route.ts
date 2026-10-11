import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { clientIpFromHeaders } from '@/server/utils/hash';
import { verifyTurnstileToken } from '@/server/security/turnstile';

export const dynamic = 'force-dynamic';

const schema = z.object({
  turnstileToken: z.string().trim().min(1).max(2048),
});

export const POST = withErrorHandling(
  'auth.password_reset',
  async (ctx, request: Request) => {
    await enforceRateLimit(
      `password-reset:${clientIpFromHeaders(request.headers) ?? 'unknown'}`,
      5,
      900,
    );

    const body = await readJson(request, schema, ctx);
    await verifyTurnstileToken(body.turnstileToken, 'forgot-password');

    return NextResponse.json(
      {
        ok: true,
        data: {
          accepted: true,
        },
      },
      {
        status: 200,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  },
);
