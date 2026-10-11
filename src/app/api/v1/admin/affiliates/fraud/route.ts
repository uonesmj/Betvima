import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.affiliates.fraud.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'affiliates.fraud');
  const params = searchParams(request);
  const pageSize = intParam(params, 'pageSize', 25, 100);
  const page = intParam(params, 'page', 1, 5000);
  const status = params.get('status');
  const rows = await services.db.query<Record<string, unknown>>(
    `select f.*, a.code as affiliate_code, p.email as user_email
       from nova.affiliate_fraud_flags f
       join nova.affiliates a on a.id = f.affiliate_id
       left join nova.profiles p on p.id = f.user_id
      where ($1::text is null or f.status = $1)
      order by case f.severity when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end desc, f.created_at desc
      limit $2 offset $3`,
    [status, pageSize, (page - 1) * pageSize],
  );
  return jsonOk({ items: rows, page, pageSize });
});

const schema = z.object({
  flagId: z.string().uuid(),
  status: z.enum(['open', 'reviewing', 'confirmed', 'dismissed']),
  resolution: z.string().min(8).max(500),
});

export const PATCH = withErrorHandling('admin.affiliates.fraud.update', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'affiliates.fraud');
  const body = await readJson(request, schema, ctx);
  const row = await services.db.queryOne<Record<string, unknown>>(
    `update nova.affiliate_fraud_flags set status = $2, resolution = $3, reviewed_by = $4, reviewed_at = now()
      where id = $1 returning id, status, resolution`,
    [body.flagId, body.status, body.resolution, user.id],
  );
  await services.admin.writeAudit({
    actorId: user.id, action: 'affiliate.fraud_reviewed', entityType: 'affiliate_fraud_flag', entityId: body.flagId,
    after: { status: body.status }, reason: body.resolution, correlationId: actor.correlationId,
  });
  return jsonOk({ flag: row });
});
