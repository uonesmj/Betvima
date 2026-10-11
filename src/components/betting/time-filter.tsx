'use client';

import { useMemo, useState } from 'react';
import { MatchListClient } from '@/components/betting/match-list-client';
import type { MatchView } from '@/components/betting/match-card';

type TimeFilterProps = {
  items: MatchView[];
  liveEnabled: boolean;
};

const FILTERS = [
  { label: 'All', hours: null },
  { label: '1h', hours: 1 },
  { label: '2h', hours: 2 },
  { label: '4h', hours: 4 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '1d', hours: 24 },
  { label: '2d', hours: 48 },
] as const;

export function TimeFilter({
  items,
  liveEnabled,
}: TimeFilterProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (selected === null) return items;

    const now = Date.now();
    const until = now + selected * 60 * 60 * 1000;

    return items.filter((item) => {
      const time = Date.parse(item.scheduledAt);

      return (
        Number.isFinite(time) &&
        time >= now &&
        time <= until
      );
    });
  }, [items, selected]);

  return (
    <>
      <div
        className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-none"
        dir="ltr"
      >
        {FILTERS.map((filter) => {
          const active = selected === filter.hours;

          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => setSelected(filter.hours)}
              className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-extrabold transition ${
                active
                  ? 'bg-[#20242A] text-white'
                  : 'border border-[#DDE1E6] bg-white text-[#59616B] hover:bg-[#F5F7F9]'
              }`}
            >
              {filter.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelected(null)}
          className="ml-auto shrink-0 rounded-full border border-[#DDE1E6] bg-white px-3 py-2 text-[10px] font-bold text-[#59616B] hover:bg-[#F5F7F9]"
        >
          Time
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="nova-card p-8 text-center text-sm nova-muted">
          {selected === null
            ? 'No events published for this sport yet.'
            : 'No events in this time range.'}
        </p>
      ) : (
        <MatchListClient
          matches={filtered}
          liveEnabled={liveEnabled}
        />
      )}
    </>
  );
}
