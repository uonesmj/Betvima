import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling('auth.logout', async (_ctx, request: Request) => {
  const env = serverEnv();
  const response = NextResponse.json({ ok: true, data: { signedOut: true } });
  // Clear the Supabase session cookies; the token itself is revoked provider-side.
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const pair of cookieHeader.split('; ')) {
    const name = pair.split('=')[0];
    if (name && (name.startsWith('sb-') || name === 'nova_ref')) {
      response.cookies.set(name, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: env.isProduction });
    }
  }
  return response;
});
