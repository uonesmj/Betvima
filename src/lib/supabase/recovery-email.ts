'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Recovery links are usually opened from mail apps in a *different browser*
 * than the one that requested them. Unlike the ordinary SSR sign-in client,
 * do not issue a PKCE code that requires a verifier stored in the first browser.
 *
 * This client sends recovery emails only. It never stores credentials or
 * replaces the normal authenticated session/cookie client.
 */
export async function requestEmailPasswordRecovery(
  email: string,
  portal: 'sportsbook' | 'affiliate',
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Password recovery is unavailable');

  const recoveryClient = createClient(url, anonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });

  const redirectTo = new URL('/auth/reset-password', window.location.origin);
  if (portal === 'affiliate') redirectTo.searchParams.set('from', 'affiliate');

  const { error } = await recoveryClient.auth.resetPasswordForEmail(
    email.trim(),
    { redirectTo: redirectTo.toString() },
  );
  if (error) throw error;
}
