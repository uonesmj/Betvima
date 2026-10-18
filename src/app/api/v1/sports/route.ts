import { withErrorHandling, jsonOk } from '@/lib/errors';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';
export const dynamic = 'force-dynamic';
export const GET = withErrorHandling('sports.list', async () => jsonOk({
  sports: BETSAPI_SPORTS.map(s => ({ key: s.key, nameEn: s.name, nameFa: s.name, icon: null })),
  countries: [],
  source: 'betsapi_bet365',
}));
