/**
 * Server-side guards for authenticated and administrative API routes.
 * The session is resolved from the Supabase cookie; permissions are checked here AND
 * re-checked by the database for every privileged operation.
 */
import { ApiError } from '@/lib/errors';
import { createServices, type Services } from '@/server/services/container';
import { actorFrom, requireAdmin, requireUser, resolveSession, type AuthResolution } from '@/server/auth/session';
import type { ActorContext } from '@/lib/ports/db';
import type { AdminPermission, SessionUser } from '@/lib/types';

export interface AuthedRequest {
  services: Services;
  auth: AuthResolution;
  user: SessionUser;
  actor: ActorContext;
}

export interface AdminRequest extends AuthedRequest {
  permission: AdminPermission;
}

export async function withUser(request: Request, ctx: { correlationId: string }, permission?: AdminPermission): Promise<AuthedRequest> {
  const auth = await resolveSession(request);
  console.info('[WITH_USER]', JSON.stringify({
    hasUser: Boolean(auth.user),
    userIdPresent: Boolean(auth.user?.id),
    status: auth.user?.status ?? null,
    authUnavailable: auth.authUnavailable,
    accessTokenPresent: Boolean(auth.accessToken),
  }));
  const user = requireUser(auth);
  if (user.status === 'suspended' || user.status === 'closed') throw new ApiError('ACCOUNT_SUSPENDED', `Account is ${user.status}`);
  if (permission) requireAdmin(user, permission);
  const actor = actorFrom(request, auth, ctx.correlationId);
  return { services: createServices(), auth, user, actor };
}

export async function withAffiliate(request: Request, ctx: { correlationId: string }): Promise<AuthedRequest> {
  const base = await withUser(request, ctx);
  if (base.user.role !== "affiliate") throw new ApiError("FORBIDDEN", "Affiliate access required");
  const affiliate = await base.services.affiliate.getByUserId(base.user.id);
  if (!affiliate || base.user.affiliateId !== affiliate.id) throw new ApiError("AFFILIATE_NOT_FOUND", "No affiliate account is linked to this user");
  return base;
}

export async function withAdmin(request: Request, ctx: { correlationId: string }, permission: AdminPermission): Promise<AdminRequest> {
  const base = await withUser(request, ctx, permission);
  return { ...base, permission };
}

/** Actor context for routes that only read public data. */
export function publicActor(request: Request, correlationId: string): ActorContext {
  return {
    userId: null, role: 'anon', adminId: null,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'), correlationId, locale: 'en',
  };
}
