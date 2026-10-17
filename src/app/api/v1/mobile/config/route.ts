import { NextResponse } from 'next/server';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

/**
 * Public mobile bootstrap. These NEXT_PUBLIC credentials are the same anonymous
 * client credentials already shipped to browsers; NEVER expose service-role keys.
 */
export async function GET() {
  const env = serverEnv();
  return NextResponse.json({
    ok: true,
    data: {
      authenticationConfigured: env.supabaseConfigured,
      supabaseUrl: env.supabaseConfigured ? env.NEXT_PUBLIC_SUPABASE_URL : null,
      supabaseAnonKey: env.supabaseConfigured ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY : null,
      // Public Cloudflare site key for the native challenge; never expose the secret key.
      turnstileSiteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null,
      minAge: 18,
      wageringEnabled: false,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
