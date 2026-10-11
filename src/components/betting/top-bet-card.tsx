import Link from 'next/link';
import { Flame, Plus } from 'lucide-react';
import { formatRelative } from '@/lib/i18n';
import { TopBetOdds } from './top-bet-odds';
import type { MatchView } from './match-card';

export function TopBetCard({ match, liveEnabled = false }: { match: MatchView; liveEnabled?: boolean }) {
  const matchForDisplay = match.isLive && !liveEnabled
    ? { ...match, isBettingAvailable: false }
    : match;
  const market = match.topMarkets?.find((m) => m.status === 'open' && m.selections.some((s) => s.status !== 'suspended'));
  const home = match.participants.find((p) => p.role === 'HOME');
  const away = match.participants.find((p) => p.role === 'AWAY');
  const selections = market ? market.selections.filter((s) => s.status !== 'suspended').slice(0, 3) : [];
  return (
    <article className='overflow-hidden rounded-2xl border border-[#E0E4E8] bg-white shadow-[0_3px_14px_rgba(20,30,40,.055)]' data-testid='top-bet-card' data-match-id={match.id}>
      <div className='flex items-center justify-between border-b border-[#ECEEF1] bg-[#F7F8FA] px-4 py-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white shadow-sm'>{match.leagueLogoUrl ? <img src={match.leagueLogoUrl} alt='' className='h-5 w-5 object-contain' /> : <Flame size={14} className='text-[#F04A63]' />}</span>
          <div className='min-w-0'>
            <p className='truncate text-[11px] font-extrabold text-[#343A42]'>{match.leagueName ?? match.sportKey}</p>
            <p className='truncate text-[9px] text-[#9298A1]'>{match.countryCode ?? 'International'}</p>
          </div>
        </div>
        <span className='shrink-0 text-[10px] font-bold text-[#707780]'>{formatRelative(match.scheduledAt)}</span>
      </div>
      <Link href={'/match/' + match.id} className='block px-4 pb-3 pt-4'>
        <div className='mb-3 flex items-center justify-between text-[10px] font-semibold text-[#7D848D]'>
          <span>{new Date(match.scheduledAt).toLocaleDateString('en-GB')}</span>
          <span>{new Date(match.scheduledAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div className='flex items-center gap-3'>
          <div className='grid min-w-0 flex-1 grid-cols-[32px_minmax(0,1fr)] items-center gap-x-2 gap-y-2'>
            {home?.logoUrl ? <img src={home.logoUrl} alt='' className='h-8 w-8 object-contain' loading='lazy' /> : <span className='h-8 w-8 rounded-full bg-[#F1F3F5]' />}
            <span className='truncate text-[13px] font-extrabold text-[#20242A]'>{home?.name ?? 'TBD'}</span>
            {away?.logoUrl ? <img src={away.logoUrl} alt='' className='h-8 w-8 object-contain' loading='lazy' /> : <span className='h-8 w-8 rounded-full bg-[#F1F3F5]' />}
            <span className='truncate text-[13px] font-extrabold text-[#20242A]'>{away?.name ?? 'TBD'}</span>
          </div>
          <div className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F0F2F5] text-[#69717B]'><Plus size={18} /></div>
        </div>
      </Link>
      <div className='border-t border-[#ECEEF1] px-3 pb-3 pt-2.5'>
        {market && selections.length ? <TopBetOdds match={matchForDisplay} market={market} selections={selections} /> : <div className='rounded-xl bg-[#F5F6F8] px-3 py-3 text-center text-[10px] font-semibold text-[#969CA5]'>Odds unavailable</div>}
      </div>
    </article>
  );
}
