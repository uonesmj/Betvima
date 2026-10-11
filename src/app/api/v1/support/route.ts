import { z } from 'zod';
import { ApiError, withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser } from '@/server/http/guard';
import type { SupportTicketStatus, SupportTicketCategory } from '@/lib/ports';

export const dynamic = 'force-dynamic';

const categorySchema = z.enum([
  'deposit',
  'withdrawal',
  'bet',
  'login',
  'bonus',
  'technical',
  'other',
  'general',
]);

const statusSchema = z.enum([
  'open',
  'waiting_user',
  'waiting_support',
  'resolved',
  'closed',
]);

const createSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  category: categorySchema,
  body: z.string().trim().min(1).max(5000),
});

const pageParam = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
};

export const GET = withErrorHandling('support.list', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get('status');
  const statusResult = rawStatus ? statusSchema.safeParse(rawStatus) : null;
  if (statusResult && !statusResult.success) {
    throw new ApiError('VALIDATION_FAILED', 'Invalid support status.');
  }

  const page = pageParam(url.searchParams.get('page'), 1, 10_000);
  const pageSize = pageParam(url.searchParams.get('pageSize'), 25, 100);

  const tickets = await services.support.listForUser(user.id, {
    ...(statusResult?.success ? { status: statusResult.data as SupportTicketStatus } : {}),
    page,
    pageSize,
  });

  return jsonOk({ tickets });
});

export const POST = withErrorHandling('support.create', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const body = await readJson(request, createSchema, ctx);

  const result = await services.support.createTicket({
    userId: user.id,
    subject: body.subject,
    category: body.category as SupportTicketCategory,
    body: body.body,
  });

  return jsonCreated({
    ticket: result.ticket,
    message: result.message,
  });
});
