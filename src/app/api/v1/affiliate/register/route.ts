import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { withErrorHandling, jsonCreated } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/server/env';
import { serviceRoleClient } from '@/server/db/supabase';
import { createServices } from '@/server/services/container';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().email().max(254),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/),
  password: z.string().min(8).max(128),
  payoutAccountId: z.string().trim().min(4).max(120),
});

function generateAffiliateCode() {
  return `NOVA${randomBytes(6).toString('hex').toUpperCase()}`;
}

export const POST = withErrorHandling('affiliate.register', async (ctx, request: Request) => {
  const body = await readJson(request, schema, ctx);
  const db = getDb();

  const existingUsername = await db.queryOne<{ id: string }>(
    `select id from nova.profiles where lower(username) = lower($1) limit 1`,
    [body.username],
  );

  if (existingUsername) {
    throw new ApiError('CONFLICT', 'Username already taken');
  }

  const supabase = serviceRoleClient();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      username: body.username,
      account_type: 'affiliate',
    },
  });

  if (createError || !created.user) {
    const message = createError?.message?.toLowerCase() ?? '';
    if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
      throw new ApiError('CONFLICT', 'Email already registered');
    }
    throw new ApiError('INTERNAL_ERROR', 'Unable to create affiliate account');
  }

  const userId = created.user.id;
  let affiliateCreated = false;

  try {
    const services = createServices();

    const affiliate = await services.affiliate.register({
      userId,
      username: body.username,
      code: generateAffiliateCode(),
      displayName: body.username,
      email: body.email,
      accountNumber: body.payoutAccountId,
      model: 'PROFIT_LOSS_35',
      rateBps: 7000,
      actorId: userId,
    });

    affiliateCreated = true;

    const env = serverEnv();
    return NextResponse.json(
      { ok: true, data: { affiliate, authenticated: false, pendingApproval: affiliate.status !== 'approved' } },
      { status: 201, headers: { 'cache-control': 'no-store' } }
    );

  } catch (error) {
    if (!affiliateCreated) {
      try { await db.query(`delete from nova.profiles where id = $1`, [userId]); } catch {}
      try { await supabase.auth.admin.deleteUser(userId); } catch {}
    }
    throw error;
  }
});
