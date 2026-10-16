import { z } from 'zod';
import { ApiError, withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('account.profile.get', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const profile = await services.users.getProfile(user.id);
  return jsonOk({ profile, session: user });
});

const patchSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  preferredLocale: z.literal('en').optional(),
  timezone: z.string().min(2).max(64).optional(),
  phone: z.string().min(6).max(32).optional(),
});

export const PATCH = withErrorHandling('account.profile.update', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const patch = await readJson(request, patchSchema, ctx);
  if (patch.phone !== undefined) {
    // Do not pretend a phone is verified merely because a client saved its text.
    throw new ApiError('BAD_REQUEST', 'Phone changes require a verified SMS challenge.');
  }
  if (patch.displayName !== undefined) {
    const existing = await services.users.getProfile(user.id);
    if (!existing) throw new ApiError('NOT_FOUND', 'Account not found');
    if (existing.fullName?.trim()) {
      throw new ApiError('BAD_REQUEST', 'Legal name has already been set and cannot be changed here.');
    }
    const words = patch.displayName.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      throw new ApiError('BAD_REQUEST', 'First and last name are both required.');
    }
  }
  const profile = await services.users.updateProfile(user.id, {
    ...(patch.displayName ? { username: patch.displayName } : {}),
    ...(patch.preferredLocale ? { preferredLocale: patch.preferredLocale } : {}),
    ...(patch.timezone ? { timezone: patch.timezone } : {}),
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'profile.updated', entityType: 'profile', entityId: user.id,
    after: patch, reason: 'customer self-service update', correlationId: actor.correlationId,
  });
  return jsonOk({ profile });
});
