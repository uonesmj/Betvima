import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAffiliate } from '@/server/http/guard';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('affiliate.links.list', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const rows = await services.db.query<Record<string, unknown>>(
    `select l.id, l.code, l.campaign, l.source, l.medium, l.landing_path, l.label, l.is_active, l.created_at,
            (select count(*) from nova.affiliate_clicks c where c.link_id = l.id) as clicks
       from nova.affiliate_links l where l.affiliate_id = $1 order by l.created_at desc`,
    [affiliate.id],
  );
  const base = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return jsonOk({
    links: rows.map((r: Record<string, unknown>) => ({ ...r, url: `${base}/ref/${String(r.code)}` })),
    primaryUrl: `${base}/ref/${affiliate.code}`,
    code: affiliate.code,
  });
});

const schema = z.object({
  campaign: z.string().min(2).max(60),
  source: z.string().min(2).max(40).optional(),
  medium: z.enum(['social', 'search', 'display', 'email', 'direct', 'influencer']).optional(),
  landingPath: z.string().max(120).default('/'),
});

export const POST = withErrorHandling('affiliate.links.create', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const body = await readJson(request, schema, ctx);
  const campaignCode = body.campaign.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'CAMPAIGN';
  const code = `${affiliate.code}-${campaignCode}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const row = await services.db.queryOne<Record<string, unknown>>(
    `insert into nova.affiliate_links (affiliate_id, code, campaign, source, medium, landing_path)
     values ($1,$2,$3,$4,$5,$6) returning id, code, campaign, source, medium, landing_path, is_active, created_at`,
    [affiliate.id, code, body.campaign, body.source ?? null, body.medium ?? null, body.landingPath],
  );
  return jsonCreated({ link: row });
});
