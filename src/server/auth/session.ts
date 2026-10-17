/**
 * SESSION / AUTHORISATION (server-side only).
 *
 * Identity comes from the Supabase auth session cookie verified by the server. There is
 * NO client-supplied user id anywhere in the money paths. When Supabase is not
 * configured the application still runs, but every authenticated area honestly reports
 * "authentication unavailable" instead of offering a fake login.
 */
import { serverEnv } from '@/server/env';
import { serviceRoleClient, userScopedClient } from '@/server/db/supabase';
import { getDb } from '@/server/db';
import { ApiError } from '@/lib/errors';
import { isAdminRole, permissionsForRole, roleHasPermission } from './rbac';
import type { AdminPermission, SessionUser, UUID, UserProfile } from '@/lib/types';
import type { ActorContext } from '@/lib/ports/db';
import { hashSignal, clientIpFromHeaders } from '@/server/utils/hash';
import { assuranceLevelFromVerifiedToken, hasVerifiedTotp } from './mfa-policy';

const ROLE_CACHE_TTL_MS = 10_000;
const roleCache = new Map<string, { role: string; expires: number }>();

export interface AuthResolution {
  user: SessionUser | null;
  /** True when the deployment has no auth backend at all. */
  authUnavailable: boolean;
  accessToken: string | null;
}

/** Resolve the signed-in user from the request cookies (Supabase SSR). */
export async function resolveSession(request: Request): Promise<AuthResolution> {
  const env = serverEnv();

  if (!env.supabaseConfigured) {
    return {
      user: null,
      authUnavailable: true,
      accessToken: null,
    };
  }

  try {
    const authorization = request.headers.get('authorization') ?? '';
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
    const bearerToken = bearerMatch?.[1]?.trim() || null;

    let authUser: { id: string; email?: string | null; factors?: { factor_type?: string; status?: string }[] } | null = null;
    let accessToken: string | null = bearerToken;

    if (bearerToken) {
      /*
       * API authentication path.
       *
       * The JWT is explicitly supplied to Supabase Auth for verification.
       * The caller never supplies a user id and no user id is trusted.
       */
      const { createClient } = await import('@supabase/supabase-js');

      const client = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

      const { data, error } = await client.auth.getUser(bearerToken);

      if (error || !data.user) {
        return {
          user: null,
          authUnavailable: false,
          accessToken: null,
        };
      }

      authUser = {
        id: data.user.id,
        email: data.user.email,
        factors: data.user.factors,
      };
    } else {
      /*
       * Browser / SSR authentication path.
       * Keep the existing Supabase SSR cookie flow unchanged.
       */
      const { createServerClient } = await import('@supabase/ssr');
      const { createClient } = await import('@supabase/supabase-js');
      const cookieHeader = request.headers.get('cookie') ?? '';

      console.info('[AUTH_DEBUG]', JSON.stringify({
        cookieHeaderLength: cookieHeader.length,
        cookieNames: cookieHeader
          .split(';')
          .map((x) => (x.split('=')[0] ?? '').trim())
          .filter(Boolean),
        hasBearer: /^Bearer\s+/i.test(request.headers.get('authorization') ?? ''),
      }));

      const client = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll: () =>
              cookieHeader
                .split(';')
                .filter(Boolean)
                .map((pair) => {
                  const [name, ...rest] = pair.trim().split('=');
                  return {
                    name: name!,
                    value: rest.join('='),
                  };
                }),
            setAll: () => undefined,
          },
        },
      );

      const sessionStartedAt = Date.now();
      console.info('[AUTH_STAGE]', JSON.stringify({ stage: 'getSession:start' }));
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();
      console.info('[AUTH_STAGE]', JSON.stringify({
        stage: 'getSession:end',
        ms: Date.now() - sessionStartedAt,
        hasSession: Boolean(sessionData.session),
        hasError: Boolean(sessionError),
        errorName: sessionError?.name ?? null,
        errorStatus: sessionError?.status ?? null,
      }));

      const sessionToken = sessionData.session?.access_token ?? null;

      if (sessionError || !sessionToken) {
        console.info('[AUTH_RESULT]', JSON.stringify({
          hasUser: false,
          errorName: sessionError?.name ?? 'AuthSessionMissingError',
          errorCode: sessionError?.code ?? null,
          errorStatus: sessionError?.status ?? null,
          errorMessage: sessionError?.message ?? 'Auth session missing!',
        }));
        authUser = null;
      } else {
        const validator = createClient(
          env.NEXT_PUBLIC_SUPABASE_URL,
          env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          },
        );

        const validatorStartedAt = Date.now();
        console.info('[AUTH_STAGE]', JSON.stringify({ stage: 'validator.getUser:start' }));
        const { data, error } = await validator.auth.getUser(sessionToken);
        console.info('[AUTH_STAGE]', JSON.stringify({
          stage: 'validator.getUser:end',
          ms: Date.now() - validatorStartedAt,
          hasUser: Boolean(data.user),
          hasError: Boolean(error),
          errorName: error?.name ?? null,
          errorStatus: error?.status ?? null,
        }));

        console.info('[AUTH_RESULT]', JSON.stringify({
          hasUser: Boolean(data.user),
          errorName: error?.name ?? null,
          errorCode: error?.code ?? null,
          errorStatus: error?.status ?? null,
          errorMessage: error?.message ?? null,
        }));

        authUser = data.user
          ? {
              id: data.user.id,
              email: data.user.email,
              factors: data.user.factors,
            }
          : null;

        accessToken = authUser ? sessionToken : null;
      }
    }

    if (!authUser) {
      return {
        user: null,
        authUnavailable: false,
        accessToken,
      };
    }

    const profile = await loadProfile(authUser.id);

    if (!profile) {
      return {
        user: null,
        authUnavailable: false,
        accessToken,
      };
    }

    const permissions = permissionsForRole(profile.role);

    return {
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        permissions,
        locale: profile.preferredLocale,
        currency: profile.preferredCurrency,
        affiliateId: profile.affiliateId,
        isAdmin: isAdminRole(profile.role),
        mfaLevel: assuranceLevelFromVerifiedToken(accessToken),
        mfaEnrolled: hasVerifiedTotp(authUser.factors),
      },
      authUnavailable: false,
      accessToken,
    };
  } catch (error) {
    console.error('[AUTH_CATCH]', JSON.stringify({
      name: error instanceof Error ? error.name : null,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    }));
    return {
      user: null,
      authUnavailable: false,
      accessToken: null,
    };
  }
}

/** Load a profile through the service-role connection (server-only, never exposed). */
export async function loadProfile(userId: UUID): Promise<UserProfile | null> {
  const db = getDb();
  const cached = roleCache.get(userId);
  const row = await db.queryOne<Record<string, unknown>>(
    `select p.*, l.self_excluded_until,
            (select id from nova.affiliates a where a.user_id = p.id) as affiliate_id
       from nova.profiles p left join nova.user_limits l on l.user_id = p.id and l.currency = p.preferred_currency
      where p.id = $1`, [userId],
  );
  console.info('[AUTH_PROFILE]', JSON.stringify({ hasProfile: Boolean(row) }));
  if (!row) return null;
  const role = String(row.role ?? 'user');
  if (!cached || cached.expires < Date.now()) roleCache.set(userId, { role, expires: Date.now() + ROLE_CACHE_TTL_MS });
  const { mapProfile } = await import('@/server/adapters/postgres/users');
  return mapProfile(row);
}

export function actorFrom(request: Request, auth: AuthResolution, correlationId: string | null): ActorContext {
  return {
    userId: auth.user?.id ?? null,
    role: auth.user ? 'authenticated' : 'anon',
    adminId: auth.user?.isAdmin ? auth.user.id : null,
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent'),
    correlationId,
    locale: auth.user?.locale ?? 'en',
  };
}

export function requireUser(auth: AuthResolution): SessionUser {
  if (auth.authUnavailable) throw new ApiError('SERVICE_UNAVAILABLE', 'Authentication backend is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  if (!auth.user) throw new ApiError('UNAUTHENTICATED');
  // Opt-in customers must complete their enrolled TOTP before accessing APIs.
  if (auth.user.mfaEnrolled && auth.user.mfaLevel !== 'aal2') {
    throw new ApiError('FORBIDDEN', 'MFA_REQUIRED: Verify your authenticator code to continue');
  }
  return auth.user;
}

export function requirePermission(user: SessionUser, permission: AdminPermission): void {
  if (!roleHasPermission(user.role, permission)) {
    throw new ApiError('PERMISSION_DENIED', `Missing permission: ${permission}`);
  }
}

/** The database re-checks admin rights; this is the fast, user-facing gate. */
export function requireAdmin(user: SessionUser, permission?: AdminPermission): void {
  if (!user.isAdmin) throw new ApiError('FORBIDDEN', 'Administrative access required');
  // Admins must enroll MFA and obtain an actual AAL2 session.
  // No bypass through direct REST API calls, stale tabs or hidden admin screens.
  if (!user.mfaEnrolled || user.mfaLevel !== 'aal2') {
    throw new ApiError('FORBIDDEN', 'ADMIN_MFA_REQUIRED: Enroll and verify Google Authenticator before administrative actions');
  }
  if (permission) requirePermission(user, permission);
}

export async function requireServiceRoleConfigured(): Promise<void> {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'SUPABASE_SERVICE_ROLE_KEY is not configured (server-side only)');
  }
}

/** True when the request may proceed under the IP allowlist (admin surface hardening). */
export function ipAllowlisted(request: Request): boolean {
  const env = serverEnv();
  if (!env.ADMIN_IP_ALLOWLIST) return true;
  const allow = env.ADMIN_IP_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean);
  if (allow.length === 0) return true;
  const ip = clientIpFromHeaders(request.headers) ?? '';
  return allow.includes(ip);
}

export const signalHash = hashSignal;

/** Service-role client accessor kept behind one function so scans have one place to look. */
export function privilegedClient() {
  return serviceRoleClient();
}

export function userClient(accessToken: string) {
  return userScopedClient(accessToken);
}
