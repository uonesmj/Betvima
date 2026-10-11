/**
 * NOTIFICATION WORKER
 * Claims queued notifications (`for update skip locked`), renders the channel message
 * and delivers it through the configured provider. With no provider the delivery is
 * recorded as `suppressed` with an explicit reason - the queue never lies about success.
 * In-app notifications are considered delivered once stored.
 */
import { createWorker, type WorkerContext, type JobHandler } from './runtime';
import { serverEnv } from '@/server/env';

const env = serverEnv();

const handlers: JobHandler[] = [
  {
    kinds: ['notification.deliver'],
    async handle(job, ctx: WorkerContext) {
      const notificationId = String(job.payload.notificationId ?? '');
      return deliverOne(ctx, notificationId);
    },
  },
];

createWorker({
  queue: 'notification',
  handlers,
  tickIntervalMs: 10_000,
  pollIntervalMs: 2_000,
  batchSize: 10,
  async tick(ctx) {
    await ctx.withLock('notification:outbox', 60, async () => {
      const claimed = await ctx.services.notifications.claimOutbox(25, ctx.workerId);
      for (const item of claimed) {
        const channel = (item.channel as 'in_app' | 'email' | 'sms' | 'push') ?? 'in_app';
        if (channel === 'in_app') {
          // Already visible in the bell menu; mark it sent with the DB timestamp.
          await ctx.services.notifications.markDelivered({ id: item.id, status: 'sent', providerMessageId: null });
          continue;
        }
        const provider = channel === 'email' ? ctx.services.providers.email : channel === 'sms' ? ctx.services.providers.sms : ctx.services.providers.push;
        if (!provider.configured) {
          await ctx.services.notifications.markDelivered({
            id: item.id, status: 'suppressed',
            error: `NO_${channel.toUpperCase()}_PROVIDER: configure NOTIFY_${channel.toUpperCase()}_PROVIDER to deliver this notification`,
          });
          continue;
        }
        const destinationEmail =
          channel === 'email' && typeof item.data?.destinationEmail === 'string'
            ? item.data.destinationEmail.trim()
            : '';
        const profileEmail = destinationEmail
          ? null
          : await ctx.services.db.queryOne<{ email: string | null }>(
              `select email from nova.profiles where id = $1`, [item.userId],
            ).catch(() => null);
        const recipientEmail = destinationEmail || profileEmail?.email?.trim() || '';
        if (!recipientEmail) {
          await ctx.services.notifications.markDelivered({ id: item.id, status: 'failed', error: 'NO_DESTINATION' });
          continue;
        }
        const result = await provider.send({
          to: recipientEmail, subject: item.title, body: item.body,
          locale: 'en', channel, data: { eventKey: item.eventKey },
        });
        await ctx.services.notifications.markDelivered({
          id: item.id,
          status: result.ok ? 'sent' : 'failed',
          providerMessageId: result.ok ? (result.value?.providerMessageId ?? null) : null,
          error: result.ok ? null : (result.errorMessage ?? result.errorCode ?? 'PROVIDER_ERROR'),
        });
      }
    });
  },
});

async function deliverOne(ctx: WorkerContext, notificationId: string) {
  const row = await ctx.services.db.queryOne<{ id: string; status: string; channel: string }>(
    `select id, status, channel from nova.notifications where id = $1`, [notificationId],
  );
  if (!row) throw new Error('NOT_FOUND:notification');
  if (row.status === 'sent') return { notificationId, status: 'already_sent' };
  return { notificationId, status: 'queued_for_delivery', channel: row.channel };
}
