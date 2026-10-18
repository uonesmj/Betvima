'use client';

import Link from 'next/link';

export type Bet365HomeFixture = {
  fi: string | null;
  home: string;
  away: string;
  league: string;
  score: string | null;
  minute: number | null;
  kickoff: string | null;
};

export function Bet365HomeCards({
  fixtures, mode,
}: { fixtures: Bet365HomeFixture[]; mode: 'live' | 'upcoming' }) {
  if (!fixtures.length) return null;
  return (
    <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {fixtures.map((match, index) => (
        <Link
          key={match.fi ?? index}
          href={match.fi ? '/betsapi?mode=' + mode + '&sport=1&fi=' + encodeURIComponent(match.fi) : '/betsapi'}
          className="w-[60vw] min-w-[60vw] max-w-[60vw] shrink-0 snap-start overflow-hidden rounded-[14px] border border-[#DDE1E6] bg-white text-[#20242A] shadow-[0_3px_12px_rgba(0,0,0,.055)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-3 py-3">
            <span className="truncate text-[11px] font-bold">{match.league || 'Football'}</span>
            <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[9px] font-black text-[#087FF5]">
              {mode === 'live' ? 'LIVE' : 'PRE'}
            </span>
          </div>
          <div className="space-y-2 px-3 py-4">
            <p className="line-clamp-2 min-h-[38px] text-[13px] font-extrabold">{match.home} — {match.away}</p>
            <p className="text-[11px] font-bold text-[#087FF5]">
              {mode === 'live' ? (match.score ?? 'In play') +
                (match.minute == null ? '' : ' · ' + match.minute + "'")
                : match.kickoff ? new Date(match.kickoff).toLocaleString() : 'Upcoming'}
            </p>
          </div>
          <div className="border-t border-[#E5E7EB] bg-[#F5F6F8] px-3 py-3 text-[11px] font-bold text-[#087FF5]">
            Bet365 · View markets (preview only) →
          </div>
        </Link>
      ))}
    </div>
  );
}
