import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { resolveSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

/** Who am I? Never 500s when auth is unconfigured: it reports the honest state. */
export const GET = withErrorHandling('auth.session', async (_ctx, request: Request) => {
  const session = await resolveSession(request);
  return NextResponse.json({
    ok: true,
    data: {
      authenticated: Boolean(session.user),
      authUnavailable: session.authUnavailable,
      user: session.user ?? null,
    },
  }, { headers: { 'cache-control': 'no-store' } });
});
