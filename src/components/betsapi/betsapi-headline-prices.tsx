'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/layout/providers';

type Price = { label: string; decimal: string };
type Preview = { market: { name: string; selections: Price[] } | null; marketCount?: number; error: string | null };
type Envelope = { ok: boolean; data?: Preview };

/**
 * Inline odds are purely informational, never SlipItems. Bet365 fixture IDs
 * are not local market/selection UUIDs, so prices must not be bettable here.
 * Lazy-load only cards actually seen by a visitor to protect trial quota.
 */
export function BetsApiHeadlinePrices({
  matchId, variant = 'list',
}: {
  matchId: string;
  variant?: 'list' | 'home';
}) {
  const { locale } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<Preview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '140px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [matchId]);

  useEffect(() => {
    if (!visible) return;
    const match = /^betsapi:(live|upcoming):(\d{1,4}):(\d{1,16})$/.exec(matchId);
    if (!match) { setLoaded(true); return; }
    const controller = new AbortController();
    setLoaded(false);
    setData(null);
    const query = new URLSearchParams({ mode: match[1]!, sportId: match[2]!, fi: match[3]! });
    fetch('/api/v1/betsapi/card-prices?' + query, { cache: 'no-store', signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('NETWORK'); return r.json() as Promise<Envelope>; })
      .then(body => setData(body.ok ? body.data ?? null : null))
      .catch(() => { if (!controller.signal.aborted) setData(null); })
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, [visible, matchId]);

  const compact = variant === 'home';
  const market = data?.market;
  const pending = !visible || !loaded;
  const available = !!market && market.selections.length > 0;
  const background = compact ? 'border-t border-[#E5E7EB] bg-[#F5F6F8] p-2' : 'space-y-2';
  return (
    <div ref={ref} className={background} aria-label={locale === 'fa' ? 'نمایش ضرایب BetsAPI' : 'BetsAPI odds preview'}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className={`min-w-0 truncate font-semibold text-[#677380] ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
          {available ? market.name : pending
            ? (locale === 'fa' ? 'در حال دریافت ضرایب…' : 'Loading odds…')
            : locale === 'fa' ? 'ضریب فعلاً موجود نیست' : 'Odds currently unavailable'}
        </span>
        <span className={`shrink-0 font-bold text-[#8B95A2] ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {available ? `${data?.marketCount ?? 0} markets` : 'BetsAPI'}
        </span>
      </div>
      <div className={`grid grid-cols-3 ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {Array.from({ length: 3 }, (_, i) => {
          const selection = market?.selections[i];
          return <div key={i} aria-disabled="true"
            title={selection ? `${selection.label}: ${selection.decimal} (read-only)` : undefined}
            className={`flex flex-col items-center justify-center rounded-lg border border-[#E4E9EF] bg-white text-center ${compact ? 'min-h-[45px] px-1 py-1.5' : 'min-h-[53px] px-1.5 py-2'}`}>
            {selection ? <>
              <span className="w-full truncate text-[9px] font-semibold text-[#768391]">{selection.label}</span>
              <strong className="mt-1 text-[12px] font-black tabular-nums text-[#1D2C3D]">{selection.decimal}</strong>
            </> : <span className="text-sm text-[#9AA5B2]">{pending ? '…' : '—'}</span>}
          </div>;
        })}
      </div>
      <p className={`text-[9px] leading-tight text-[#80909E] ${compact ? 'mt-1' : ''}`}>
        {locale === 'fa' ? 'صرفاً نمایش؛ ثبت شرط غیرفعال' : 'Preview only · betting disabled'}
      </p>
    </div>
  );
}
