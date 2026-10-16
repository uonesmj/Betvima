import { NextResponse } from 'next/server';
import { casinoEnabled, casinoGames } from '@/server/providers/softaggregator/client';
import { filterCasinoCatalogue } from '@/server/providers/softaggregator/catalogue-filters';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!casinoEnabled()) return NextResponse.json({ error: 'CASINO_DISABLED' }, { status: 503 });
  try {
    const q = new URL(request.url).searchParams;
    const category = (q.get('category') ?? '').toLowerCase().slice(0, 40);
    const provider = (q.get('provider') ?? '').toLowerCase().slice(0, 80);
    const search = (q.get('q') ?? '').toLowerCase().slice(0, 80);
    const page = Math.min(1000, Math.max(1, Number(q.get('page')) || 1));
    const limit = Math.min(100, Math.max(1, Number(q.get('limit')) || 40));
    const all = await casinoGames();
    const { games, providers } = filterCasinoCatalogue(all, { category, provider, search });
    return NextResponse.json({ ok: true, data: {
      items: games.slice((page - 1) * limit, page * limit).map((g) => ({
        id: g.id_hash, name: g.name, category: g.game_type, provider: g.provider,
        providerName: g.provider_name ?? g.provider, image: g.image ?? null,
        // Explicitly provider-confirmed playable demo; other titles may support demo too.
        demoSupported: g.id_hash === 'x887bde40b16350c' || g.play_for_fun_supported === true,
      })),
      total: games.length, page, limit, providers,
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'CASINO_CATALOGUE_UNAVAILABLE' }, { status: 502 });
  }
}
