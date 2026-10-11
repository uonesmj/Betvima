import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAffiliate } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(
  'affiliate.gift_codes.list',
  async (ctx, request: Request) => {
    const { services, user } = await withAffiliate(request, ctx);
    const affiliate = await services.affiliate.getByUserId(user.id);
    if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');

    const rows = await services.db.query<Record<string, unknown>>(
      `select id, code, is_active, usage_count, last_used_at, created_at
         from nova.affiliate_registration_gift_codes
        where affiliate_id = $1
        order by created_at desc`,
      [affiliate.id],
    );

    return jsonOk({
      items: rows.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        isActive: Boolean(r.is_active),
        usageCount: Number(r.usage_count ?? 0),
        lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
        createdAt: String(r.created_at),
      })),
      limit: 10,
    });
  },
);

const schema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9]{4,8}$/),
});

export const POST = withErrorHandling(
  'affiliate.gift_codes.create',
  async (ctx, request: Request) => {
    const { services, user } = await withAffiliate(request, ctx);
    const affiliate = await services.affiliate.getByUserId(user.id);
    if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');

    const body = await readJson(request, schema, ctx);

    const result = await services.db.rpc<Record<string, unknown>>(
      'create_affiliate_registration_gift_code',
      {
        p_affiliate_id: affiliate.id,
        p_code: body.code.toUpperCase(),
      },
    );

    return jsonCreated({
      giftCode: {
        id: String(result.id),
        affiliateId: String(result.affiliate_id),
        code: String(result.code),
        isActive: Boolean(result.is_active),
        usageCount: Number(result.usage_count ?? 0),
      },
    });
  },
);
