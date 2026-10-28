import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser, withAdmin } from '@/server/http/guard';
import { requireAdmin } from '@/server/auth/session';
import { section, type DegradedSection } from '@/server/http/degrade';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  action: z.enum(['set_status', 'set_role', 'update_limits', 'add_note']),
  status: z.enum(['active', 'restricted', 'suspended', 'closed', 'self_excluded']).optional(),
  role: z.enum(['user', 'affiliate', 'support', 'finance', 'risk_manager', 'settlement_manager', 'trader', 'affiliate_manager', 'admin', 'super_admin']).optional(),
  reason: z.string().min(8).max(500).optional(),
  note: z.string().min(4).max(2000).optional(),
  limits: z.record(z.string().regex(/^\d{1,19}$/)).optional(),
});

export const GET = withErrorHandling('admin.users.get', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services } = await withAdmin(request, ctx, 'users.view');
  const summary = await services.users.getAdminSummary(id);
  if (!summary) throw new ApiError('NOT_FOUND', 'User not found');
  const degraded: DegradedSection[] = [];
  const emptyPage = { items: [] as unknown[], total: 0, page: 1, pageSize: 10, hasMore: false };
  const [notes, bets, wallet, payments, restrictions] = await Promise.all([
    section('notes', degraded, () => services.users.listNotes(id), [], ctx.correlationId),
    section('bets', degraded, () => services.betting.listBets(
      { userId: null, role: 'service_role', adminId: null, ip: null, userAgent: null, correlationId: null },
      { userId: id, page: 1, pageSize: 10 },
    ), emptyPage, ctx.correlationId),
    section('wallet', degraded, () => services.wallet.getWallet(
      { userId: null, role: 'service_role', adminId: null, ip: null, userAgent: null, correlationId: null }, id, 'IRT',
    ), null, ctx.correlationId),
    section('payments', degraded, () => services.payments.listIntents({ userId: id, page: 1, pageSize: 10 }), emptyPage, ctx.correlationId),
    section('restrictions', degraded, () => services.db.query<Record<string, unknown>>(
      `select * from nova.user_restrictions where user_id = $1 and (effective_to is null or effective_to > now()) order by created_at desc`, [id],
    ), [], ctx.correlationId),
  ]);
  return jsonOk({ summary, notes, bets, wallet, payments, restrictions, degraded });
});

/** Every mutation is permission-checked and written to the audit log. */
export const PATCH = withErrorHandling('admin.users.patch', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  // 1. resolve the session (401 / 503 before anything else),
  // 2. then validate the payload,
  // 3. then check the permission that the requested action requires.
  const { services, user } = await withUser(request, ctx);
  const body = await readJson(request, patchSchema, ctx);
  const permission = body.action === 'set_role' ? 'admin.roles'
    : body.action === 'update_limits' ? 'limits.edit'
    : body.action === 'add_note' ? 'users.notes' : 'users.status';
  requireAdmin(user, permission);
  const actorId = user.id;
  switch (body.action) {
    case 'set_status': {
      if (user.id === id) throw new ApiError('FORBIDDEN', 'You cannot change your own administrator status');
      const target = await services.db.queryOne<{ role: string }>(
        "select role::text as role from nova.profiles where id=$1", [id],
      );
      if (!target || !['user','affiliate'].includes(target.role))
        throw new ApiError('FORBIDDEN', 'Account status actions in this panel are for players only');
      if (!body.status) throw new ApiError('VALIDATION_FAILED', 'status is required');
      const reason = body.reason ?? 'administrative change';
      const profile = await services.users.setStatus({ userId: id, status: body.status, reason, actorId });
      return jsonOk({ profile });
    }
    case 'set_role': {
      if (!body.role) throw new ApiError('VALIDATION_FAILED', 'role is required');
      const profile = await services.users.setRole({ userId: id, role: body.role, actorId, reason: body.reason ?? 'role assignment' });
      return jsonOk({ profile });
    }
    case 'update_limits': {
      const limits = Object.fromEntries(Object.entries(body.limits ?? {}).map(([k, v]) => [k, BigInt(v)]));
      const updated = await services.users.updateLimits({ userId: id, limits, actorId });
      return jsonOk({ limits: updated });
    }
    case 'add_note': {
      if (!body.note) throw new ApiError('VALIDATION_FAILED', 'note is required');
      const note = await services.users.addNote({ userId: id, actorId, note: body.note, isInternal: true });
      return jsonOk({ note });
    }
    default:
      throw new ApiError('VALIDATION_FAILED', 'Unsupported action');
  }
});
