import { z } from 'zod';
import { ApiError, withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { enforceRateLimit, readJson } from '@/server/http/request';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
}).refine(({ currentPassword, newPassword }) => currentPassword !== newPassword,
  { message: 'New password must differ from the current password' });

/** Fresh password reauthentication is mandatory, not merely a valid stored JWT. */
export const POST = withErrorHandling('account.password.change', async (ctx, request: Request) => {
  const { user } = await withUser(request, ctx);
  await enforceRateLimit('password-change:' + user.id, 5, 900);
  const { currentPassword, newPassword } = await readJson(request, bodySchema, ctx);
  const env = serverEnv();
  if (!env.supabaseConfigured) throw new ApiError('SERVICE_UNAVAILABLE');

  // Authenticate against the same identity provider used for normal sign-in.
  // Neither password, token, nor upstream response body is written to logs.
  const origin = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  const proof = await fetch(origin + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers,
    body: JSON.stringify({ email: user.email, password: currentPassword }),
    cache: 'no-store',
  });
  const identity = (await proof.json().catch(() => null)) as {
    access_token?: string; user?: { id?: string };
  } | null;
  if (!proof.ok || !identity?.access_token || identity.user?.id !== user.id) {
    throw new ApiError('VALIDATION_FAILED', 'Current password is incorrect');
  }

  // Scoped user token: never use service role to alter account credentials.
  const updated = await fetch(origin + '/auth/v1/user', {
    method: 'PUT',
    headers: { ...headers, Authorization: 'Bearer ' + identity.access_token },
    body: JSON.stringify({ password: newPassword }),
    cache: 'no-store',
  });
  if (!updated.ok) {
    throw new ApiError('VALIDATION_FAILED',
      'Password update was rejected. Please choose a different strong password.');
  }
  return jsonOk({ changed: true });
});
