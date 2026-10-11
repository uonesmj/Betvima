'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type LiveLeague = {
  sportKey: string;
  leagueId: string | null;
  leagueName: string | null;
  leagueLogoUrl: string | null;
  countryCode: string | null;
};

type Level = 'sports' | 'countries' | 'leagues';

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'England', ENG: 'England', ES: 'Spain', IT: 'Italy', DE: 'Germany',
  FR: 'France', TR: 'Turkey', AR: 'Argentina', BR: 'Brazil', US: 'USA',
  AU: 'Australia', BE: 'Belgium', AT: 'Austria', NL: 'Netherlands',
  PT: 'Portugal', SE: 'Sweden', DK: 'Denmark', NO: 'Norway',
  CH: 'Switzerland', MX: 'Mexico', CL: 'Chile', CO: 'Colombia',
  JP: 'Japan', KR: 'South Korea', CN: 'China', IN: 'India', ZA: 'South Africa',
};

const SPORTS = ['football', 'basketball', 'tennis', 'ice-hockey', 'baseball', 'cricket', 'volleyball', 'handball', 'esports'];

function sportLabel(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function LiveMenu({ leagues }: { leagues: LiveLeague[] }) {
  const router = useRouter();
  const [level, setLevel] = useState<Level>('sports');
  const [sport, setSport] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  const availableSports = SPORTS.filter(s => leagues.some(l => l.sportKey === s));
  const countries = [...new Set(
    leagues.filter(l => l.sportKey === sport && l.countryCode).map(l => l.countryCode as string)
  )].sort();

  const visibleLeagues = leagues.filter(l =>
    l.sportKey === sport &&
    (!country || l.countryCode === country)
  );

  const selectSport = (value: string) => {
    setSport(value);
    setCountry(null);
    setLevel(value === 'football' ? 'countries' : 'leagues');
  };

  const selectLeague = (league: LiveLeague) => {
    const id = league.leagueId ?? league.leagueName ?? league.sportKey;
    router.push(`/live?league=${encodeURIComponent(id)}`);
  };

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border bg-white px-3 py-3 shadow">
        <span className="text-sm font-black">LIVE</span>
        <span className="text-sm text-slate-600">All live matches</span>
        <span className="text-sm">⌄</span>
      </summary>

      <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-white p-2 shadow-xl">
        {level === 'sports' && (
          <div className="space-y-1">
            {availableSports.map(value => (
              <button key={value} type="button" onClick={() => selectSport(value)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
                <img src={`/sports-new/svg/${value}.svg`} className="h-6 w-6" alt="" />
                <span className="flex-1 text-sm font-bold">{sportLabel(value)}</span>
                <span>›</span>
              </button>
            ))}
          </div>
        )}

        {level === 'countries' && (
          <div className="space-y-1">
            <button type="button" onClick={() => setLevel('sports')}
              className="px-3 py-2 text-xs font-bold text-slate-500">
              ‹ All sports
            </button>

            {countries.map(value => (
              <button key={value} type="button"
                onClick={() => { setCountry(value); setLevel('leagues'); }}
                className="flex w-full justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50">
                <span className="text-sm font-bold">{COUNTRY_NAMES[value] ?? value}</span>
                <span>›</span>
              </button>
            ))}
          </div>
        )}

        {level === 'leagues' && (
          <div className="space-y-1">
            <button type="button"
              onClick={() => sport === 'football' ? setLevel('countries') : setLevel('sports')}
              className="px-3 py-2 text-xs font-bold text-slate-500">
              ‹ Back
            </button>

            {visibleLeagues.map(league => {
              const id = league.leagueId ?? league.leagueName ?? league.sportKey;
              return (
                <button key={id} type="button" onClick={() => selectLeague(league)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
                  <img
                    src={league.leagueLogoUrl ?? `/sports-new/svg/${league.sportKey}.svg`}
                    className="h-8 w-8 object-contain"
                    alt=""
                  />
                  <span className="flex-1 text-sm font-bold">
                    {league.leagueName ?? league.sportKey}
                  </span>
                  <span>›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
