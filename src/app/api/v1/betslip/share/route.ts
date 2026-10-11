import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ApiError, withErrorHandling, jsonCreated } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { createServices } from '@/server/services/container';

export const dynamic = 'force-dynamic';

const selectionSchema = z.object({
  matchId: z.string().uuid(),
  marketId: z.string().uuid(),
  selectionId: z.string().uuid(),
  label: z.string().max(300).default(''),
  marketLabel: z.string().max(300).default(''),
  matchLabel: z.string().max(500).default(''),
  sportSlug: z.string().max(100).default(''),
  oddsScaled: z.string().regex(/^\d{1,12}$/).default('0'),
  oddsVersionSeen: z.number().int().nonnegative().default(1),
});

const shareSchema = z.object({
  type: z.enum(['SINGLE', 'MULTIPLE']),
  currency: z.enum(['IRT', 'IRR', 'USD', 'EUR', 'GBP']),
  selections: z.array(selectionSchema).min(1).max(20),
});

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `NOVA-${code}`;
}

export const POST = withErrorHandling('betslip.share.create', async (ctx, request: Request) => {
  const body = await readJson(request, shareSchema, ctx);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  await enforceRateLimit(`betslip-share:${ip}`, 30, 60);
  const services = createServices();
  for (const selection of body.selections) {
    const snapshots = await services.catalog.getSelectionsForPlacement(selection.matchId, [selection.selectionId]);
    const snapshot = snapshots[0];
    if (snapshot == null || snapshot.marketId !== selection.marketId) throw new ApiError('UNPROCESSABLE', 'One or more selections are no longer available');
  }
  const selections = body.selections.map((selection) => ({
    matchId: selection.matchId,
    marketId: selection.marketId,
    selectionId: selection.selectionId,
    label: selection.label,
    marketLabel: selection.marketLabel,
    matchLabel: selection.matchLabel,
    sportSlug: selection.sportSlug,
    oddsScaled: selection.oddsScaled,
    oddsVersionSeen: selection.oddsVersionSeen,
  }));
  const code = makeCode();
  const row = await services.db.queryOne<{ code: string }>(`insert into nova.bet_slip_shares (code, slip_type, currency, selections) values (\$1, \$2, \$3, \$4::jsonb) returning code`, [code, body.type, body.currency, JSON.stringify(selections)]);
  if (row == null) throw new ApiError('INTERNAL_ERROR', 'Unable to create bet slip code');
  return jsonCreated({ code: row.code });
});
