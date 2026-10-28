import { z } from 'zod';
import { jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { casinoFinance } from '@/server/admin/casino-finance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const windows: Record<string, number | null> = { '24h': 1, '7d': 7, '30d': 30, 'all': null };
export const GET = withErrorHandling('admin.mobile.casino', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'reports.view');
  const url = new URL(request.url);
  const window = z.enum(['24h','7d','30d','all']).catch('24h').parse(url.searchParams.get('window'));
  const days = windows[window];
  const since = days === null || days === undefined ? null : new Date(Date.now() - days * 86_400_000);
  const periods = await casinoFinance(services.db, null, since);
  return jsonOk({
    window, periods,
    totalRounds: periods.reduce((sum, row) => sum + row.rounds, 0),
    accountingNote: 'Only committed operations; refunds excluded from casino GGR. Currency and provider are never implicitly mixed.',
  });
});
