/**
 * Supabase wiring - SERVER AND WORKER ONLY.
 *
 * The service-role key must never reach the browser: it is read here, used only by
 * server code, never prefixed with NEXT_PUBLIC_, never logged and never returned by
 * an API route (verified by `npm run scan:secrets`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSsrServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from '@/server/env';
import { PostgresDb, pgConfigFromEnv, type PgDbConfig } from './postgres';

let serviceClient: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Only for privileged server/worker code. */
export function serviceRoleClient(): SupabaseClient {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!process.env.NEXT_RUNTIME && typeof window !== 'undefined') {
    throw new Error('REFUSED: the service-role client cannot be constructed in a browser context');
  }
  serviceClient ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'nova-sportsbook-server' } },
  });
  return serviceClient;
}

/** Anonymous client (browser-safe key) bound to the caller's auth cookies. */
export function userScopedClient(accessToken?: string): SupabaseClient {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}

/** Next.js App Router server client (cookie-bound) - used for auth flows and RLS-safe reads. */
export async function cookieBoundClient() {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('SUPABASE_NOT_CONFIGURED');
  const store = await cookies();
  return createSsrServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options as never));
        } catch {
          /* called from a read-only context (RSC render) - the middleware refreshes cookies instead */
        }
      },
    },
  });
}

/**
 * Subclass used when the deployment is Supabase-managed. Reads still use SQL over a
 * direct connection (portal/transaction pooler) because the authoritative logic lives
 * in the database; PostgREST is used for auth/admin APIs only.
 */
export class SupabaseDb extends PostgresDb {
  declare readonly kind: 'supabase';

  constructor(config: PgDbConfig = pgConfigFromEnv()) {
    super({ ...config, applicationName: 'nova-sportsbook-supabase' });
    (this as { kind: 'postgres' | 'supabase' }).kind = 'supabase';
  }

  static fromEnv(): SupabaseDb {
    const env = serverEnv();
    if (!env.SUPABASE_DB_URL && !process.env.DATABASE_URL) {
      throw new Error('SUPABASE_DB_URL_REQUIRED: set the pooler connection string for server-side SQL access');
    }
    return new SupabaseDb(pgConfigFromEnv());
  }
}
