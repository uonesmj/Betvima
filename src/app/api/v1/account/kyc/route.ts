import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

/**
 * KYC submission. Documents are stored by the storage provider (Supabase Storage);
 * without it, the request is refused rather than pretending verification happened.
 */
export const GET = withErrorHandling('account.kyc.get', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const profile = await services.users.getProfile(user.id);
  return jsonOk({ kycStatus: profile?.kycStatus ?? 'not_started', status: profile?.status ?? null });
});

const schema = z.object({
  documentType: z.enum(['national_id', 'passport', 'drivers_license']),
  documentNumber: z.string().min(4).max(64),
  storagePath: z.string().min(3).max(256),
  selfiePath: z.string().min(3).max(256).optional(),
});

export const POST = withErrorHandling('account.kyc.submit', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const body = await readJson(request, schema, ctx);
  const profile = await services.users.getProfile(user.id);
  if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found');
  const result = await services.users.setKyc({
    userId: user.id, status: 'pending', actorId: user.id,
    note: `${body.documentType} submitted (ref ${body.storagePath.slice(0, 40)})`,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'kyc.submitted', entityType: 'profile', entityId: user.id,
    after: { documentType: body.documentType, selfie: Boolean(body.selfiePath) },
    reason: 'customer KYC submission', correlationId: actor.correlationId,
  });
  return jsonOk({ kycStatus: result.kycStatus });
});
