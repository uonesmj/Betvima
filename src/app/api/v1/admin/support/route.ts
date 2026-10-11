import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import type { UUID } from '@/lib/types';
import type {
  SupportTicketStatus,
  SupportTicketCategory,
  SupportTicketPriority,
} from '@/lib/ports';

const statuses = new Set<SupportTicketStatus>([
  'open',
  'waiting_user',
  'waiting_support',
  'resolved',
  'closed',
]);

const categories = new Set<SupportTicketCategory>([
  'deposit',
  'withdrawal',
  'bet',
  'login',
  'bonus',
  'technical',
  'other',
  'general',
]);

const priorities = new Set<SupportTicketPriority>([
  'low',
  'normal',
  'high',
  'urgent',
]);

const pageParam = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
};

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.support.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'support.view');
  const url = new URL(request.url);

  const rawStatus = url.searchParams.get('status');
  const rawCategory = url.searchParams.get('category');
  const rawPriority = url.searchParams.get('priority');
  const rawAssignedTo = url.searchParams.get('assignedTo');
  const search = url.searchParams.get('search')?.trim() || undefined;

  if (rawStatus && !statuses.has(rawStatus as SupportTicketStatus)) {
    return (() => { throw new Error('Invalid support status'); })();
  }
  if (rawCategory && !categories.has(rawCategory as SupportTicketCategory)) {
    return (() => { throw new Error('Invalid support category'); })();
  }
  if (rawPriority && !priorities.has(rawPriority as SupportTicketPriority)) {
    return (() => { throw new Error('Invalid support priority'); })();
  }

  let assignedTo: UUID | null | undefined;
  if (rawAssignedTo === 'unassigned') {
    assignedTo = null;
  } else if (rawAssignedTo) {
    assignedTo = rawAssignedTo as UUID;
  }

  const page = pageParam(url.searchParams.get('page'), 1, 10_000);
  const pageSize = pageParam(url.searchParams.get('pageSize'), 25, 100);

  const tickets = await services.support.listForAdmin({
    ...(rawStatus ? { status: rawStatus as SupportTicketStatus } : {}),
    ...(rawCategory ? { category: rawCategory as SupportTicketCategory } : {}),
    ...(rawPriority ? { priority: rawPriority as SupportTicketPriority } : {}),
    ...(assignedTo !== undefined ? { assignedTo } : {}),
    ...(search ? { search } : {}),
    page,
    pageSize,
  });

  return jsonOk({ tickets });
});
