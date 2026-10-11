import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.settings.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'settings.view');
  const settings = await services.admin.settings();
  return jsonOk({ settings: settings.map((s) => ({ ...s, value: s.isSecret ? '••••••' : s.value })) });
});

const schema = z.object({ key: z.string().min(3).max(120), value: z.unknown() });

export const PATCH = withErrorHandling('admin.settings.update', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'settings.edit');
  const body = await readJson(request, schema, ctx);
  const setting = await services.admin.updateSetting({ key: body.key, value: body.value, actorId: user.id });
  await services.admin.writeAudit({
    actorId: user.id, action: 'settings.updated', entityType: 'setting', entityId: body.key,
    after: { value: body.value }, reason: 'admin settings update', correlationId: actor.correlationId,
  });
  return jsonOk({ setting: { ...setting, value: setting.isSecret ? '••••••' : setting.value } });
});
