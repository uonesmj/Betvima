import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.risk.rules.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'risk.view');
  return jsonOk({ rules: await services.admin.riskRules() });
});

const schema = z.object({
  key: z.string().min(3).max(60),
  scope: z.enum(['GLOBAL', 'SPORT', 'LEAGUE', 'AFFILIATE', 'USER']).default('GLOBAL'),
  scopeRef: z.string().max(120).nullish(),
  thresholdMinor: z.string().regex(/^\d{1,19}$/).nullish(),
  action: z.enum(['REVIEW', 'LIMIT', 'WARN', 'REJECT']).default('REVIEW'),
  priority: z.number().int().min(0).max(10_000).default(100),
  isEnabled: z.boolean().default(true),
  reason: z.string().max(300).nullish(),
});

export const POST = withErrorHandling('admin.risk.rules.upsert', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'risk.edit');
  const body = await readJson(request, schema, ctx);
  const rule = await services.admin.upsertRiskRule({
    actorId: user.id,
    rule: {
      key: body.key, scope: body.scope, scopeRef: body.scopeRef ?? null,
      thresholdMinor: body.thresholdMinor ? BigInt(body.thresholdMinor) : null,
      action: body.action, priority: body.priority, isEnabled: body.isEnabled,
      params: { reason: body.reason ?? null },
    },
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'risk.rule_upserted', entityType: 'risk_rule', entityId: rule.id,
    after: body, reason: body.reason ?? 'risk rule change', correlationId: actor.correlationId,
  });
  return jsonCreated({ rule });
});
