'use client';

import { useMemo, useState } from 'react';
import { Activity, BarChart3, ChevronDown, Clock3, LockKeyhole, Search, ShieldAlert } from 'lucide-react';
import type { FootballFixture, FootballMarket } from '@/lib/football-live-feed';
import { footballLeagues, renderableOdds } from '@/lib/football-live-feed';

type Tab = 'markets' | 'stats' | 'events';

function MatchCenter({ fixture }: { fixture: FootballFixture }) {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<Tab>('markets');
  const [category, setCategory] = useState('All');
  const categories = [...new Set(fixture.markets.map(market => market.category))];
  const markets = fixture.markets.filter(market => category === 'All' || market.category === category);
  const minute = fixture.state === 'halftime' ? 'HT' : fixture.state === 'finished' ? 'FT' :
    fixture.state === 'suspended' ? 'PAUSED' : String(fixture.minute) + "'";
  const statistics = [
    ['Possession %', fixture.statistics.possession],
    ['Shots', fixture.statistics.shots],
    ['Shots on target', fixture.statistics.shotsOnTarget],
    ['Corners', fixture.statistics.corners],
    ['Yellow cards', fixture.statistics.yellowCards],
    ['Red cards', fixture.statistics.redCards],
    ['Fouls', fixture.statistics.fouls],
  ] as const;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" aria-expanded={opened} onClick={() => setOpened(!opened)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50">
        <span className="rounded-xl bg-emerald-100 px-2 py-2 text-sm font-black text-emerald-800">{minute}</span>
        <span className="min-w-0 flex-1 space-y-1 text-sm font-bold text-slate-900">
          <span className="block truncate">{fixture.home.name}</span>
          <span className="block truncate">{fixture.away.name}</span>
        </span>
        <span className="grid gap-1 text-right text-base font-black tabular-nums text-slate-900">
          <span>{fixture.score.home}</span><span>{fixture.score.away}</span>
        </span>
        <span className="ml-2 hidden gap-1.5 sm:flex">
          {fixture.markets[0]?.selections.slice(0, 3).map(option => (
            <span key={option.id} className="flex min-w-14 flex-col rounded-lg bg-slate-100 p-2 text-center text-xs">
              <span className="text-slate-500">{option.label}</span>
              <span className="font-bold tabular-nums text-slate-800">
                {renderableOdds(fixture.state, fixture.markets[0].status, option)}
              </span>
            </span>
          ))}
        </span>
        <ChevronDown size={16} className={opened ? 'rotate-180 text-slate-500' : 'text-slate-500'}/>
      </button>
      {opened ? (
        <div className="border-t border-slate-100">
          <div className="flex gap-2 border-b border-slate-100 px-4 pt-3" role="tablist" aria-label="Match detail">
            {([
              ['markets', 'Markets', Activity],
              ['stats', 'Statistics', BarChart3],
              ['events', 'Events', Clock3],
            ] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold ' +
                  (tab === value ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500')}>
                <Icon size={14}/>{label}
              </button>
            ))}
          </div>
          {tab === 'markets' ? (
            <div className="space-y-3 p-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {['All', ...categories].map(value => (
                  <button type="button" key={value} onClick={() => setCategory(value)}
                    className={'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ' +
                      (category === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}>
                    {value}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {markets.map((market: FootballMarket) => (
                  <div key={market.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div className="mb-3 flex justify-between gap-2 text-xs font-bold text-slate-800">
                      <span>{market.name}{market.line ? ' · ' + market.line : ''}</span>
                      {market.status !== 'open' ? <span className="text-amber-700">Suspended</span> : null}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {market.selections.map(option => (
                        <div key={option.id} title="Read-only demonstration: bets disabled."
                          className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center">
                          <div className="truncate text-[11px] text-slate-500">{option.label}</div>
                          <div className="font-bold tabular-nums text-slate-900">
                            {renderableOdds(fixture.state, market.status, option)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {tab === 'stats' ? (
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {statistics.map(([label, value]) => (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{value?.home ?? '—'}</span><span>{label}</span><span>{value?.away ?? '—'}</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="bg-emerald-500" style={{
                      width: ((value && value.home + value.away > 0) ?
                        value.home / (value.home + value.away) * 100 : 50) + '%',
                    }}/>
                    <div className="flex-1 bg-sky-400"/>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {tab === 'events' ? (
            <div className="space-y-2 p-4">
              {fixture.incidents.length === 0 ? <p className="text-sm text-slate-500">No incident data.</p> : null}
              {[...fixture.incidents].sort((a, b) => b.minute - a.minute).map(event => (
                <div key={event.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <span className="font-black text-emerald-700">{event.minute}'</span>
                  <span className="rounded bg-white px-2 py-1 font-semibold uppercase text-slate-500">
                    {event.type.replaceAll('_', ' ')}
                  </span>
                  <span className="flex-1 text-slate-700">{event.description}</span>
                  <span className="text-slate-400">{event.side}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function FootballLivePreview({ fixtures }: { fixtures: FootballFixture[] }) {
  const [search, setSearch] = useState('');
  const [league, setLeague] = useState('all');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const leagues = useMemo(() => footballLeagues(fixtures), [fixtures]);
  const shown = fixtures.filter(fixture => (league === 'all' || fixture.leagueId === league) &&
    (!search || (fixture.home.name + ' ' + fixture.away.name + ' ' + fixture.leagueName)
      .toLowerCase().includes(search.toLowerCase().trim())));
  const groups = leagues.map(group => ({
    ...group, matches: shown.filter(fixture => fixture.leagueId === group.id),
  })).filter(group => group.matches.length);
  return (
    <div className="mx-auto max-w-6xl space-y-4" dir="ltr">
      <header className="rounded-2xl bg-[#12191d] p-6 text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <Activity size={16}/> BetVima · Football live
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">All football markets & match center</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Fictional sample fixtures. This is a preview of the data contract and interface,
          not a live bookmaker feed.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-200">
          <ShieldAlert size={16}/> DEMO ONLY · NO REAL ODDS · BETTING DISABLED
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
          <Search size={16} className="text-slate-500"/>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search football teams or leagues"
            className="w-full bg-transparent text-sm text-slate-900 outline-none"/>
        </label>
        {[{ id: 'all', name: 'All leagues', count: fixtures.length }, ...leagues].map(item => (
          <button key={item.id} type="button" onClick={() => setLeague(item.id)}
            className={'rounded-xl px-3 py-2 text-xs font-bold ' +
              (league === item.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-600')}>
            {item.name} ({item.count})
          </button>
        ))}
      </div>
      {groups.length === 0 ?
        <p className="rounded-xl bg-white p-6 text-center text-slate-500">No matching fixtures.</p> : null}
      {groups.map(group => (
        <section key={group.id} className="space-y-2">
          <button type="button"
            onClick={() => setCollapsed(items => items.includes(group.id) ?
              items.filter(item => item !== group.id) : [...items, group.id])}
            className="flex w-full items-center justify-between rounded-xl bg-slate-900 p-4 text-left text-sm font-bold text-white">
            <span>{group.country} · {group.name}</span>
            <span className="flex items-center gap-2 text-xs text-emerald-300">
              {group.matches.length} matches <ChevronDown size={16}/>
            </span>
          </button>
          {!collapsed.includes(group.id) ?
            group.matches.map(fixture => <MatchCenter key={fixture.id} fixture={fixture}/>) : null}
        </section>
      ))}
      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <LockKeyhole size={18} className="shrink-0"/> Demo data cannot be placed in the live betting
        catalogue, used for settlement, or displayed as current bookmaker quotes.
      </div>
    </div>
  );
}
