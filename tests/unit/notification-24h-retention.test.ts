import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Db } from '@/lib/ports/db';
import { PostgresNotificationRepository, NOTIFICATION_INBOX_RETENTION_HOURS } from '@/server/adapters/postgres/notifications';

function notificationDb() {
  const statements: string[] = [];
  const db = {
    query: async (sql: string) => { statements.push(sql); return []; },
    queryOne: async (sql: string) => {
      statements.push(sql);
      return { total: 0, unread: 0 };
    },
  } as unknown as Db;
  return { repo: new PostgresNotificationRepository(db), statements };
}

describe('24 hour in-app notification retention', () => {
  it('expires unread, read and paginated notices from all inbox queries', async () => {
    const { repo, statements } = notificationDb();
    await repo.listForUser('00000000-0000-4000-8000-000000000001', { page: 1 });
    await repo.markRead('00000000-0000-4000-8000-000000000001', ['00000000-0000-4000-8000-000000000002']);
    await repo.markAllRead('00000000-0000-4000-8000-000000000001');
    expect(NOTIFICATION_INBOX_RETENTION_HOURS).toBe(24);
    expect(statements).toHaveLength(5);
    for (const sql of statements) {
      expect(sql).toContain("channel = 'in_app'");
      expect(sql).toContain("created_at > now() - interval '24 hours'");
    }
  });

  it('schedules bounded database removal of only expired in-app rows', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/0216_in_app_notification_retention_24h.sql'), 'utf8'
    );
    expect(migration).toContain("channel = 'in_app'");
    expect(migration).toContain("created_at <= now() - interval '24 hours'");
    expect(migration).toContain("'*/15 * * * *'");
    expect(migration).toContain('limit 2000');
    expect(migration).not.toMatch(/delete from public\.ticket_messages|delete from nova\.notification_campaigns/i);
  });
});
