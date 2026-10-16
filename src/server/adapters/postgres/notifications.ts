import type { Db } from '@/lib/ports/db';
import type { EnqueueNotificationInput, NotificationRepository } from '@/lib/ports/repositories';
import type { NotificationChannel, NotificationEventKey, NotificationStatus, UUID } from '@/lib/types';
import { pgArray, type Row, toIso, toIsoOrNull, toJson, toNum, toStr, toStrOrNull } from '@/server/db/rows';
import { NOTIFICATION_TYPE, NOTIFICATION_TYPE_BY_EVENT } from '@/lib/db-enums';

const CHANNELS: NotificationChannel[] = ['in_app'];

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(readonly db: Db) {}

  /**
   * In-app rows are written immediately; external channels are queued in the same row
   * and delivered by the notification worker. Without a configured provider the delivery
   * is recorded as `suppressed` with an explicit reason - never as "sent".
   */
  async enqueue(input: EnqueueNotificationInput): Promise<{ id: UUID; queued: boolean }> {
    const channels = input.channels?.length ? input.channels : CHANNELS;
    const dedupeKey = input.dedupeKey ?? null;
    const rows: Row[] = [];
    for (const channel of channels) {
      const row = await this.db.queryOne<Row>(
        `insert into nova.notifications (user_id, type, event_key, channel, title, body, data, locale, status,
            scheduled_at, dedupe_key, template_key)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'queued', coalesce($9::timestamptz, now()), $10, $3)
         on conflict (dedupe_key) where dedupe_key is not null do nothing
         returning id`,
        [input.userId, notificationTypeFor(input.eventKey), input.eventKey, channel, input.title, input.body,
          JSON.stringify(input.data ?? {}), input.locale ?? 'en', input.scheduledAt ?? null,
          dedupeKey ? `${dedupeKey}:${channel}` : null],
      );
      if (row) rows.push(row);
    }
    return { id: rows[0] ? toStr(rows[0].id) : '', queued: rows.length > 0 };
  }

  async findByDedupeKey(dedupeKey: string) {
    const row = await this.db.queryOne<Row>(
      `select id, status, body, data
         from nova.notifications
        where dedupe_key = $1
        limit 1`,
      [dedupeKey],
    );
    if (!row) return null;
    return {
      id: toStr(row.id),
      status: toStr(row.status),
      body: toStr(row.body),
      data: toJson<Record<string, unknown> | null>(row.data, null),
    };
  }

  async listForUser(userId: UUID, filter: { unreadOnly?: boolean; page?: number; pageSize?: number }) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const rows = await this.db.query<Row>(
      `select id, event_key, title, body, data, created_at, read_at from nova.notifications
        where user_id = $1 and channel = 'in_app'
          and scheduled_at <= now()
          and ($2::boolean is not true or read_at is null)
        order by created_at desc limit $3 offset $4`,
      [userId, filter.unreadOnly ?? false, pageSize, (page - 1) * pageSize],
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.notifications where user_id = $1 and channel = 'in_app'
         and scheduled_at <= now() and ($2::boolean is not true or read_at is null)`,
      [userId, filter.unreadOnly ?? false],
    );
    const unread = await this.db.queryOne<Row>(
      `select count(*) as unread from nova.notifications where user_id = $1
         and channel = 'in_app' and scheduled_at <= now() and read_at is null`,
      [userId],
    );
    const total = toNum(count?.total);
    return {
      unreadCount: toNum(unread?.unread),
      items: rows.map((r) => ({
        id: toStr(r.id), eventKey: toStr(r.event_key, 'system.maintenance'), title: toStr(r.title), body: toStr(r.body),
        createdAt: toIso(r.created_at), readAt: toIsoOrNull(r.read_at), data: toJson<Record<string, unknown> | null>(r.data, null),
      })),
      total, page, pageSize, hasMore: page * pageSize < total,
    };
  }

  async markRead(userId: UUID, ids: UUID[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await this.db.query<Row>(
      `update nova.notifications set read_at = now() where user_id = $1 and id = any($2::uuid[]) and read_at is null returning id`,
      [userId, pgArray(ids)],
    );
    return rows.length;
  }

  async markAllRead(userId: UUID): Promise<number> {
    const rows = await this.db.query<Row>(
      `update nova.notifications set read_at = now() where user_id = $1 and read_at is null returning id`, [userId],
    );
    return rows.length;
  }

  async claimOutbox(limit: number, workerId: string) {
    const rows = await this.db.query<Row>(
      `with claimed as (
         select id from nova.notifications
          where status in ('queued','failed') and attempts < max_attempts and scheduled_at <= now() and channel <> 'in_app'
          order by scheduled_at limit $1 for update skip locked
       )
       update nova.notifications n set status = 'sending', attempts = n.attempts + 1, locked_by = $2, locked_at = now()
        from claimed c where n.id = c.id
       returning n.id, n.channel, n.user_id, n.event_key, n.title, n.body, n.data, n.attempts`,
      [limit, workerId],
    );
    return rows.map((r) => ({
      id: toStr(r.id), channel: toStr(r.channel), userId: toStr(r.user_id),
      eventKey: toStr(r.event_key, 'system.maintenance'), title: toStr(r.title), body: toStr(r.body),
      data: (r.data && typeof r.data === 'object' ? r.data : null) as Record<string, unknown> | null,
      attempts: toNum(r.attempts),
    }));
  }

  async markDelivered(input: { id: UUID; status: 'sent' | 'failed' | 'suppressed'; providerMessageId?: string | null; error?: string | null }) {
    await this.db.query(
      `update nova.notifications set status = $2, sent_at = case when $2 = 'sent' then now() else sent_at end,
              last_error = $3, locked_by = null, locked_at = null
        where id = $1`,
      [input.id, input.status, input.error ?? null],
    );
    if (input.providerMessageId || input.error) {
      await this.db.query(
        `insert into nova.notification_deliveries (notification_id, channel, provider, status, attempts, provider_message_id, error)
         select id, channel, 'disabled', $2, attempts, $3, $4 from nova.notifications where id = $1`,
        [input.id, input.status, input.providerMessageId ?? null, input.error ?? null],
      );
    }
  }

  async templates() {
    const rows = await this.db.query<Row>(
      `select event_key, channel, locale, subject, body, is_enabled from nova.notification_templates order by event_key, channel, locale`,
    );
    return rows.map((r) => ({
      eventKey: toStr(r.event_key), channel: toStr(r.channel), locale: toStr(r.locale),
      subject: toStrOrNull(r.subject), body: toStr(r.body), isEnabled: Boolean(r.is_enabled),
    }));
  }

  async updateTemplate(input: { eventKey: string; channel: string; locale: string; subject?: string | null; body?: string; isEnabled?: boolean; actorId: UUID }) {
    await this.db.query(
      `update nova.notification_templates
          set subject = coalesce($4, subject), body = coalesce($5, body), is_enabled = coalesce($6, is_enabled), updated_by = $7
        where event_key = $1 and channel = $2 and locale = $3`,
      [input.eventKey, input.channel, input.locale, input.subject ?? null, input.body ?? null, input.isEnabled ?? null, input.actorId],
    );
  }
}

type NotificationTypeName = (typeof NOTIFICATION_TYPE)[number];

function notificationTypeFor(eventKey: string): NotificationTypeName {
  return NOTIFICATION_TYPE_BY_EVENT[eventKey] ?? 'system';
}

export { notificationTypeFor };
export type { NotificationChannel, NotificationEventKey, NotificationStatus };
