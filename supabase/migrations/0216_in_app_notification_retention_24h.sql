-- 0216: ephemeral user-facing in-app notifications (24 hours).
-- Support ticket messages, notification campaigns and external deliveries are
-- not notification inbox rows and must NEVER be deleted by this scheduler.
-- GET/read queries separately enforce the exact 24h cutoff between job runs.
begin;

create index if not exists notifications_in_app_expiry_idx
  on nova.notifications (created_at, id)
  where channel = 'in_app';

-- The extension is installed on the target project. Keep the schedule
-- database-native so expiration works even when no app/notification worker runs.
select cron.schedule(
  'betvima-inapp-notification-expiry-24h',
  '*/15 * * * *',
  $job$
    with due as (
      select id from nova.notifications
      where channel = 'in_app'
        and created_at <= now() - interval '24 hours'
      order by created_at
      limit 2000
      for update skip locked
    )
    delete from nova.notifications n using due
    where n.id = due.id;
  $job$
);
commit;
