import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser } from '@/server/http/guard';
import { requireAdmin } from '@/server/auth/session';
import { serviceRoleClient } from '@/server/db/supabase';

export const dynamic = 'force-dynamic';

const schema = z.object({
  password: z.string().min(8).max(128),
  reason: z.string().min(8).max(500),
});

export const POST = withErrorHandling('admin.users.password_reset', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { user } = await withUser(request, ctx);
  requireAdmin(user, 'users.password_reset');

  if (id === user.id) {
    throw new ApiError('VALIDATION_FAILED', 'Use the normal account password flow for your own account');
  }

  const body = await readJson(request, schema, ctx);
  const supabase = serviceRoleClient();

  const { data: target, error: lookupError } = await supabase.auth.admin.getUserById(id);
  if (lookupError || !target.user) {
    throw new ApiError('NOT_FOUND', 'User not found');
  }

  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: body.password,
  });

  if (error) {
    throw new ApiError('INTERNAL_ERROR', 'Unable to update user password');
  }

  return jsonOk({
    success: true,
    userId: id,
    message: 'Password changed successfully',
  });

  return jsonOk({ success: true });
});
