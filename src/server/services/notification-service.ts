/**
 * NOTIFICATION SERVICE.
 * Every user-visible event is queued in `nova.notifications` with a dedupe key, then
 * delivered by the notification worker. With no channel provider the delivery is
 * recorded as `suppressed` with an explicit reason - never as `sent`.
 */
import type { Services } from './container';
import type { UUID } from '@/lib/types';
import { createLogger } from '@/server/logger';
import { messageFor } from '@/lib/i18n/events';

const log = createLogger({ component: 'notification-service' });

export type BetEventKey =
  | 'bet.placed' | 'bet.won' | 'bet.lost' | 'bet.void' | 'bet.cashout' | 'bet.partial'
  | 'wallet.deposit' | 'wallet.withdrawal' | 'wallet.adjustment'
  | 'account.verified' | 'account.restricted' | 'account.self_excluded'
  | 'affiliate.approved' | 'affiliate.commission' | 'affiliate.payout_paid' | 'affiliate.payout_requested'
  | 'security.new_device' | 'security.login' | 'system.maintenance';

export class NotificationService {
  constructor(private readonly services: Services) {}

  async emit(input: { userId: UUID; eventKey: BetEventKey; data?: Record<string, unknown>; locale?: 'en'; dedupeKey?: string | null; scheduledAt?: string | null }): Promise<{ id: UUID; queued: boolean }> {
    const locale = input.locale ?? 'en';
    const message = messageFor(input.eventKey, locale, input.data ?? {});
    try {
      return await this.services.notifications.enqueue({
        userId: input.userId, eventKey: input.eventKey, channels: ['in_app'],
        title: message.title, body: message.body, data: input.data ?? null, locale,
        dedupeKey: input.dedupeKey ?? null, scheduledAt: input.scheduledAt ?? null,
      });
    } catch (error) {
      // Notifications must never break a money path.
      log.error('notification enqueue failed', { eventKey: input.eventKey, userId: input.userId, error: (error as Error).message });
      return { id: '', queued: false };
    }
  }
}
