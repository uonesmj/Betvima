import { z } from 'zod';
import { ApiError, jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { enforceRateLimit, readJson } from '@/server/http/request';
import type { Row } from '@/server/db/rows';

export const dynamic = 'force-dynamic';

export const notificationInput = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  audience: z.enum(['general','personal']),
  targetUserId: z.string().uuid().nullable().optional(),
  ctaLabel: z.string().trim().max(50).optional().default(''),
  ctaHref: z.string().trim().max(240).optional().default(''),
  locale: z.enum(['fa','en']).default('fa'),
  mode: z.enum(['draft','send','schedule']),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
}).superRefine((value, ctx) => {
  if ((value.audience === 'personal') !== Boolean(value.targetUserId))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetUserId'], message: 'Personal delivery requires one user; general delivery cannot target one user' });
  if (Boolean(value.ctaLabel) !== Boolean(value.ctaHref))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ctaHref'], message: 'CTA label and destination must be provided together' });
  if (value.ctaHref && (!/^\/(?!\/)[a-zA-Z0-9/_?=&.%#-]*$/.test(value.ctaHref) ||
    value.ctaHref.includes('\\')))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ctaHref'], message: 'Only relative BetVima paths are allowed' });
  if (value.mode === 'schedule' && (!value.scheduledAt || Date.parse(value.scheduledAt) <= Date.now()))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scheduledAt'], message: 'A future date is required' });
});
export type AdminNotificationInput = z.infer<typeof notificationInput>;

// Only an administrator with promo.manage can list or send campaigns.
export const GET = withErrorHandling('admin.notifications.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'promo.manage');
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(1000, Number(params.get('page')) || 1));
  const status = params.get('status') || null;
  const search = (params.get('search') || '').trim().slice(0, 100);
  if (status && !['draft','sent','scheduled','archived'].includes(status))
    throw new ApiError('VALIDATION_FAILED', 'Invalid status');
  const rows = await services.db.query<Row>(
    `select c.id, c.title, c.body, c.audience, c.target_user_id, c.action_label, c.action_path,
            c.locale, c.status, c.scheduled_at, c.created_at, c.updated_at,
            coalesce(stats.delivered,0) as delivered, coalesce(stats.read_count,0) as read_count
       from nova.notification_campaigns c
       left join lateral (
         select count(*) as delivered, count(*) filter (where n.read_at is not null) as read_count
           from nova.notifications n
          where n.data ->> 'campaignId' = c.id::text
       ) stats on true
      where ($1::text is null or c.status = $1)
        and ($2::text = '' or c.title ilike '%' || $2 || '%')
      order by c.created_at desc limit 30 offset $3`,
    [status, search, (page - 1) * 30],
  );
  return jsonOk({ items: rows, page });
});

export const POST = withErrorHandling('admin.notifications.create', async (ctx, request: Request) => {
  const { services, user } = await withAdmin(request, ctx, 'promo.manage');
  await enforceRateLimit(`notifications:admin:create:${user.id}`, 8, 60);
  const input = await readJson(request, notificationInput, ctx);
  if (input.audience === 'personal') {
    const exists = await services.db.queryOne<{ id: string }>(
      `select id from nova.profiles where id = $1 and role::text in ('user','affiliate')
         and status::text = 'active'`, [input.targetUserId]);
    if (!exists) throw new ApiError('NOT_FOUND', 'Active target user not found');
  }
  if (input.audience === 'general' && input.mode !== 'draft') {
    const total = await services.db.queryOne<{ count: string }>(
      `select count(*)::text as count from nova.profiles
         where role::text in ('user','affiliate') and status::text = 'active'`);
    if (Number(total?.count || 0) > 10000)
      throw new ApiError('VALIDATION_FAILED', 'Audience exceeds 10,000; use batch delivery before sending');
  }
  const status = input.mode === 'send' ? 'sent' : input.mode === 'schedule' ? 'scheduled' : 'draft';
  const scheduledAt = input.mode === 'schedule' ? input.scheduledAt : null;
  // A single SQL statement ensures campaign + per-user inbox rows are atomic.
  const created = await services.db.queryOne<Row>(
    `with campaign as (
       insert into nova.notification_campaigns
         (title, body, audience, target_user_id, action_label, action_path, locale,
          status, scheduled_at, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *
     ), recipients as (
       select p.id from nova.profiles p cross join campaign c
        where c.status <> 'draft'
          and p.role::text in ('user','affiliate') and p.status::text = 'active'
          and ((c.audience = 'personal' and p.id = c.target_user_id)
            or (c.audience = 'general'))
     ), inserted as (
       insert into nova.notifications
         (user_id,type,event_key,channel,title,body,data,locale,status,scheduled_at,sent_at,dedupe_key)
       select r.id,'promotion','promo.generic','in_app',c.title,c.body,
              jsonb_build_object('audience',c.audience,'campaignId',c.id,
               'ctaLabel',c.action_label,'ctaHref',c.action_path),
              c.locale, case when c.status = 'sent' then 'sent' else 'queued' end,
              coalesce(c.scheduled_at,now()),
              case when c.status = 'sent' then now() else null end,
              'campaign:' || c.id::text || ':' || r.id::text
         from recipients r cross join campaign c
       on conflict (dedupe_key) where dedupe_key is not null do nothing
       returning id
     )
     select c.id, c.status, (select count(*) from inserted) as recipients from campaign c`,
    [input.title, input.body, input.audience, input.targetUserId || null,
      input.ctaLabel || null, input.ctaHref || null, input.locale,
      status, scheduledAt, user.id],
  );
  if (!created) throw new ApiError('INTERNAL_ERROR', 'Unable to create notification');
  await services.admin.writeAudit({
    actorId: user.id, action: 'notification.create', entityType: 'notification_campaign',
    entityId: String(created.id), after: { status, audience: input.audience, recipients: created.recipients },
    correlationId: ctx.correlationId,
  });
  return jsonOk({ campaign: created });
});
