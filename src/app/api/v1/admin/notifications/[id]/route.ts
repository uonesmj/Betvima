import { z } from 'zod';
import { ApiError, jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { readJson, enforceRateLimit } from '@/server/http/request';
import type { Row } from '@/server/db/rows';

export const dynamic = 'force-dynamic';
const schema = z.object({
  action: z.enum(['publish', 'archive']),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const PATCH = withErrorHandling('admin.notifications.action', async (
  ctx, request: Request, params: { params: Promise<{ id: string }> },
) => {
  const { services, user } = await withAdmin(request, ctx, 'promo.manage');
  await enforceRateLimit(`notifications:admin:action:${user.id}`, 15, 60);
  const { id } = await params.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid campaign ID');
  const input = await readJson(request, schema, ctx);
  const existing = await services.db.queryOne<Row>(
    'select id,status,audience,target_user_id from nova.notification_campaigns where id = $1',
    [id]);
  if (!existing) throw new ApiError('NOT_FOUND', 'Notification not found');
  if (input.action === 'archive') {
    if (existing.status === 'archived') return jsonOk({ id, status: 'archived' });
    // Scheduled unread copies must not leak after an administrator archives them.
    await services.db.query(
      `with campaign as (
         update nova.notification_campaigns set status = 'archived' where id = $1 returning id
       )
       delete from nova.notifications n using campaign c
        where n.data->>'campaignId' = c.id::text and n.scheduled_at > now()`,
      [id]);
    await services.admin.writeAudit({ actorId: user.id, action: 'notification.archive',
      entityType: 'notification_campaign', entityId: id, correlationId: ctx.correlationId });
    return jsonOk({ id, status: 'archived' });
  }
  if (existing.status !== 'draft') throw new ApiError('VALIDATION_FAILED', 'Only drafts may be published');
  const scheduled = input.scheduledAt && Date.parse(input.scheduledAt) > Date.now() ? input.scheduledAt : null;
  if (existing.audience === 'general') {
    const count = await services.db.queryOne<{ count: string }>(
      `select count(*)::text as count from nova.profiles
         where role::text in ('user','affiliate') and status::text = 'active'`);
    if (Number(count?.count || 0) > 10000)
      throw new ApiError('VALIDATION_FAILED', 'Audience exceeds 10,000; use batch delivery');
  }
  const updated = await services.db.queryOne<Row>(
    `with campaign as (
       update nova.notification_campaigns
         set status = case when $2::timestamptz is null then 'sent' else 'scheduled' end,
             scheduled_at = $2::timestamptz
        where id = $1 and status = 'draft' returning *
     ), recipients as (
       select p.id from nova.profiles p cross join campaign c
        where p.role::text in ('user','affiliate') and p.status::text = 'active'
          and (c.audience = 'general' or p.id = c.target_user_id)
     ), inserted as (
       insert into nova.notifications
         (user_id,type,event_key,channel,title,body,data,locale,status,scheduled_at,sent_at,dedupe_key)
       select r.id,'promotion','promo.generic','in_app',c.title,c.body,
              jsonb_build_object('audience',c.audience,'campaignId',c.id,
                'ctaLabel',c.action_label,'ctaHref',c.action_path),
              c.locale,case when c.status = 'sent' then 'sent' else 'queued' end,
              coalesce(c.scheduled_at,now()),
              case when c.status = 'sent' then now() else null end,
              'campaign:' || c.id::text || ':' || r.id::text
       from recipients r cross join campaign c
       on conflict (dedupe_key) where dedupe_key is not null do nothing
       returning id
     )
     select c.id,c.status,(select count(*) from inserted) as recipients from campaign c`,
    [id, scheduled],
  );
  if (!updated) throw new ApiError('VALIDATION_FAILED', 'Draft already published');
  await services.admin.writeAudit({ actorId: user.id, action: 'notification.publish',
    entityType: 'notification_campaign', entityId: id,
    after: { status: updated.status, recipients: updated.recipients },
    correlationId: ctx.correlationId });
  return jsonOk({ campaign: updated });
});
