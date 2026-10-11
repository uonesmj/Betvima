import { describe, expect, it, vi } from 'vitest';
import type { League } from '@/lib/types';
import { serviceRoleContext } from '@/server/context';
import { readLeaguePageLeagues } from '@/server/queries/league-page';

const league = (id: string, sportKey: League['sportKey'] = 'football'): League => ({
  id, sportKey, countryCode: null, nameEn: id, nameFa: id, slug: id,
  tier: null, isActive: true, priority: 0, logoUrl: null,
});

describe('league page catalogue', () => {
  it('resolves an active league outside the first 200 and includes it in navigation', async () => {
    const initial = Array.from({ length: 200 }, (_, i) => league(`listed-${i}`));
    const selected = league('selected');
    const listLeagues = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce([selected]);
    const result = await readLeaguePageLeagues({ listLeagues }, serviceRoleContext, 'football', selected.id);
    expect(result.league).toEqual(selected);
    expect(result.leagues).toEqual([...initial, selected]);
    expect(listLeagues).toHaveBeenNthCalledWith(2, serviceRoleContext, {
      sportKey: 'football', leagueId: selected.id, limit: 1,
    });
    expect(initial).toHaveLength(200);
  });

  it('uses the initial list without an extra request or duplicate', async () => {
    const selected = league('selected');
    const listLeagues = vi.fn().mockResolvedValue([selected]);
    const result = await readLeaguePageLeagues({ listLeagues }, serviceRoleContext, 'football', selected.id);
    expect(result).toEqual({ league: selected, leagues: [selected] });
    expect(listLeagues).toHaveBeenCalledTimes(1);
  });

  it('keeps a genuinely missing league unavailable', async () => {
    const listLeagues = vi.fn().mockResolvedValue([]);
    await expect(readLeaguePageLeagues({ listLeagues }, serviceRoleContext, 'football', 'missing'))
      .resolves.toEqual({ league: null, leagues: [] });
  });

  it('does not accept a league belonging to another sport', async () => {
    const listLeagues = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([league('selected', 'basketball')]);
    await expect(readLeaguePageLeagues({ listLeagues }, serviceRoleContext, 'football', 'selected'))
      .resolves.toEqual({ league: null, leagues: [] });
  });

  it('does not accept a different league from a malformed lookup result', async () => {
    const listLeagues = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([league('other')]);
    await expect(readLeaguePageLeagues({ listLeagues }, serviceRoleContext, 'football', 'selected'))
      .resolves.toEqual({ league: null, leagues: [] });
  });

  it('propagates read failure instead of pretending the league is missing', async () => {
    const listLeagues = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('unavailable'));
    await expect(readLeaguePageLeagues({ listLeagues }, serviceRoleContext, 'football', 'selected'))
      .rejects.toThrow('unavailable');
  });
});
